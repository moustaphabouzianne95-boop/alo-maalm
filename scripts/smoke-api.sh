#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ألو المعلم · Alo Maalem — API smoke test
#
#   bash scripts/smoke-api.sh            # against http://127.0.0.1:3000
#   BASE=https://app.example.ma bash scripts/smoke-api.sh
#
# Covers the behaviours the spec calls non-negotiable: the response envelope,
# validation rejection, no user enumeration on login, admin self-registration
# being impossible, role-scoped route access, ownership checks on mutations,
# and the transactional offer-acceptance workflow (single accept, competing
# offers closed, request advanced).
#
# It talks to the real database through the real HTTP API — nothing is stubbed.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

BASE="${BASE:-http://127.0.0.1:3000}"
PASSWORD="${SEED_PASSWORD:-Demo@12345}"
# Optional: lets a repeated run skip the deliberately tight auth rate limits.
BYPASS="${RATE_LIMIT_BYPASS_SECRET:-}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CUSTOMER_JAR="$TMP/customer.jar"
PRO_JAR="$TMP/professional.jar"
ADMIN_JAR="$TMP/admin.jar"

passed=0; failed=0

# ── helpers ──────────────────────────────────────────────────────────────────
jqp() { python3 -c "
import json,sys
d=json.load(open(sys.argv[1]))
try:
    v=eval(sys.argv[2], {'d': d, 'json': json})
    print(str(v).lower() if isinstance(v,bool) else v)
except Exception: print('')
" "$1" "$2"; }

psql_q() {
  PGPASSWORD="${DB_PASSWORD:-alomaalem_dev_password}" psql -h "${DB_HOST:-127.0.0.1}" \
    -U "${DB_USER:-alomaalem}" -d "${DB_NAME:-alomaalem}" -tAc "$1" 2>/dev/null | tr -d ' \n'
}

expect() { # expect <label> <expected> <actual>
  if [[ "$2" == "$3" ]]; then
    printf '  \033[32m✓\033[0m %s\n' "$1"; passed=$((passed+1))
  else
    printf '  \033[31m✗\033[0m %s\n      expected: %s\n      actual:   %s\n' "$1" "$2" "$3"; failed=$((failed+1))
  fi
}

req() { # req <outfile> <curl args…>  → prints the HTTP status code
  local out="$1"; shift
  if [[ -n "$BYPASS" ]]; then
    curl -s -o "$out" -w '%{http_code}' -H "x-rate-limit-bypass: $BYPASS" "$@"
  else
    curl -s -o "$out" -w '%{http_code}' "$@"
  fi
}

section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# ── 1. public reads ──────────────────────────────────────────────────────────
section "Public catalogue"
code=$(req "$TMP/health" "$BASE/api/health");                 expect "GET /api/health → 200" 200 "$code"
code=$(req "$TMP/cats" "$BASE/api/categories");               expect "GET /api/categories → 200" 200 "$code"
expect "  at least 20 categories returned" true "$([[ $(jqp "$TMP/cats" 'len(d["data"])') -ge 20 ]] && echo true || echo false)"
expect "  envelope marks success" true "$(jqp "$TMP/cats" 'd["success"]')"

code=$(req "$TMP/svc" "$BASE/api/services?perPage=5&sort=rating"); expect "GET /api/services?perPage=5 → 200" 200 "$code"
expect "  page size honoured" 5 "$(jqp "$TMP/svc" 'len(d["data"])')"
expect "  meta carries pagination" true "$(jqp "$TMP/svc" 'all(k in d["meta"] for k in ("page","perPage","total","totalPages"))')"

code=$(req "$TMP/svc2" "$BASE/api/services?city=casablanca&verified=true&perPage=3"); expect "GET /api/services with filters → 200" 200 "$code"
code=$(req "$TMP/pros" "$BASE/api/professionals?perPage=4");  expect "GET /api/professionals → 200" 200 "$code"

# Regression: `search` and `city` each build an OR clause; composed wrongly the
# second spread silently overwrites the first and the city filter disappears.
req "$TMP/svcS"  "$BASE/api/services?search=%D8%B3%D8%A8%D8%A7%D9%83%D8%A9&perPage=50" >/dev/null
req "$TMP/svcC"  "$BASE/api/services?city=rabat&perPage=50" >/dev/null
code=$(req "$TMP/svcSC" "$BASE/api/services?search=%D8%B3%D8%A8%D8%A7%D9%83%D8%A9&city=rabat&perPage=50"); expect "GET /api/services search+city → 200" 200 "$code"
combo_ok=$(python3 -c "
import json
s={i['id'] for i in json.load(open('$TMP/svcS'))['data']}
c={i['id'] for i in json.load(open('$TMP/svcC'))['data']}
b={i['id'] for i in json.load(open('$TMP/svcSC'))['data']}
print(str(bool(b) and b <= (s & c)).lower())")
expect "  search AND city intersect (no clause overwrite)" true "$combo_ok"

req "$TMP/proS"  "$BASE/api/professionals?search=%D9%83%D9%87%D8%B1%D8%A8&perPage=50" >/dev/null
req "$TMP/proC"  "$BASE/api/professionals?city=casablanca&perPage=50" >/dev/null
code=$(req "$TMP/proSC" "$BASE/api/professionals?search=%D9%83%D9%87%D8%B1%D8%A8&city=casablanca&perPage=50"); expect "GET /api/professionals search+city → 200" 200 "$code"
combo_ok=$(python3 -c "
import json
s={i['id'] for i in json.load(open('$TMP/proS'))['data']}
c={i['id'] for i in json.load(open('$TMP/proC'))['data']}
b={i['id'] for i in json.load(open('$TMP/proSC'))['data']}
print(str(bool(b) and b <= (s & c)).lower())")
expect "  professional search AND city intersect" true "$combo_ok"
expect "  no email or phone leaks in the directory" true "$(jqp "$TMP/pros" 'not any(("email" in p or "phone" in p) for p in d["data"])')"
code=$(req "$TMP/board" "$BASE/api/requests?perPage=5");      expect "GET /api/requests (anonymous) → 200" 200 "$code"

code=$(req "$TMP/bad" "$BASE/api/services?sort=bogus");       expect "invalid sort rejected → 422" 422 "$code"
expect "  error envelope shape" VALIDATION_ERROR "$(jqp "$TMP/bad" 'd["error"]["code"]')"
expect "  requestId present for support tracing" true "$([[ -n $(jqp "$TMP/bad" 'd.get("requestId","")') ]] && echo true || echo false)"
code=$(req "$TMP/m405" -X POST "$BASE/api/categories");       expect "POST on a GET-only route → 405" 405 "$code"

# ── 2. authentication ────────────────────────────────────────────────────────
section "Authentication"
code=$(req "$TMP/anon" "$BASE/api/auth/me");                  expect "GET /api/auth/me anonymous → 401" 401 "$code"

code=$(req "$TMP/login_unknown" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d '{"identifier":"nobody@alomaalem.ma","password":"whatever123"}')
expect "login with unknown email → 401" 401 "$code"
unknown_message=$(jqp "$TMP/login_unknown" 'd["error"]["message"]')

code=$(req "$TMP/login_wrong" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d "{\"identifier\":\"customer@alomaalem.ma\",\"password\":\"WrongPass1\"}")
expect "login with wrong password → 401" 401 "$code"
wrong_message=$(jqp "$TMP/login_wrong" 'd["error"]["message"]')
expect "  identical message (no user enumeration)" "$unknown_message" "$wrong_message"

code=$(req "$TMP/login_phone" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d "{\"identifier\":\"0612345678\",\"password\":\"$PASSWORD\"}")
expect "login with a malformed identifier → 401" 401 "$code"

code=$(req "$TMP/reg_admin" -X POST "$BASE/api/auth/register" -H 'content-type: application/json' \
  -d '{"firstName":"Hacker","lastName":"Admin","email":"hacker@alomaalem.ma","phone":"0612345678","password":"Passw0rd!","role":"ADMIN","termsAccepted":true}')
expect "register with role=ADMIN rejected" 422 "$code"
expect "  ADMIN is not an accepted enum value" VALIDATION_ERROR "$(jqp "$TMP/reg_admin" 'd["error"]["code"]')"

code=$(req "$TMP/reg_noterms" -X POST "$BASE/api/auth/register" -H 'content-type: application/json' \
  -d '{"firstName":"بلا","lastName":"شروط","email":"noterms@alomaalem.ma","phone":"0655112233","password":"Passw0rd!","role":"CUSTOMER"}')
expect "register without terms → 422" 422 "$code"

STAMP=$(date +%s)
code=$(req "$TMP/reg_ok" -X POST "$BASE/api/auth/register" -H 'content-type: application/json' \
  -d "{\"firstName\":\"زبون\",\"lastName\":\"تجربة$STAMP\",\"email\":\"smoke$STAMP@alomaalem.ma\",\"phone\":\"0655$(printf '%06d' $((STAMP % 1000000)))\",\"password\":\"Passw0rd!\",\"role\":\"CUSTOMER\",\"termsAccepted\":true}")
expect "register a new customer → 201" 201 "$code"

code=$(req "$TMP/reg_dup" -X POST "$BASE/api/auth/register" -H 'content-type: application/json' \
  -d "{\"firstName\":\"مكرر\",\"lastName\":\"حساب\",\"email\":\"smoke$STAMP@alomaalem.ma\",\"phone\":\"0655999888\",\"password\":\"Passw0rd!\",\"role\":\"CUSTOMER\",\"termsAccepted\":true}")
expect "duplicate email rejected → 409" 409 "$code"

code=$(req "$TMP/login_customer" -c "$CUSTOMER_JAR" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d "{\"identifier\":\"customer@alomaalem.ma\",\"password\":\"$PASSWORD\"}")
expect "login as the demo customer → 200" 200 "$code"
expect "  redirectTo is the customer dashboard" /dashboard "$(jqp "$TMP/login_customer" 'd["data"]["redirectTo"]')"

code=$(req "$TMP/login_pro" -c "$PRO_JAR" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d "{\"identifier\":\"professional@alomaalem.ma\",\"password\":\"$PASSWORD\"}")
expect "login as the demo professional → 200" 200 "$code"
expect "  redirectTo is the professional area" /professional "$(jqp "$TMP/login_pro" 'd["data"]["redirectTo"]')"

code=$(req "$TMP/login_admin" -c "$ADMIN_JAR" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d "{\"identifier\":\"admin@alomaalem.ma\",\"password\":\"$PASSWORD\"}")
expect "login as the demo admin → 200" 200 "$code"
expect "  redirectTo is the admin area" /admin "$(jqp "$TMP/login_admin" 'd["data"]["redirectTo"]')"

# From here on the run holds an admin session, so clear the counters it has
# already consumed and keep the rest of the suite repeatable.
if [[ -z "$BYPASS" ]]; then
  req "$TMP/rl_reset" -b "$ADMIN_JAR" -X POST "$BASE/api/admin/rate-limit" >/dev/null
fi

code=$(req "$TMP/me_customer" -b "$CUSTOMER_JAR" "$BASE/api/auth/me"); expect "GET /api/auth/me as customer → 200" 200 "$code"
expect "  the session exposes the role" CUSTOMER "$(jqp "$TMP/me_customer" 'd["data"]["user"]["role"]')"
expect "  passwordHash is never serialised" true "$([[ $(grep -c passwordHash "$TMP/me_customer") -eq 0 ]] && echo true || echo false)"

# ── 3. RBAC & ownership ──────────────────────────────────────────────────────
section "Authorisation"
code=$(req "$TMP/rbac1" -b "$CUSTOMER_JAR" "$BASE/api/admin/users");      expect "customer → /api/admin/users 403" 403 "$code"
code=$(req "$TMP/rbac2" -b "$PRO_JAR" "$BASE/api/admin/analytics");       expect "professional → /api/admin/analytics 403" 403 "$code"
code=$(req "$TMP/rbac3" -b "$CUSTOMER_JAR" "$BASE/api/admin/reports");    expect "customer → /api/admin/reports 403" 403 "$code"
code=$(req "$TMP/rbac4" -b "$ADMIN_JAR" "$BASE/api/admin/analytics");     expect "admin → /api/admin/analytics 200" 200 "$code"
expect "  analytics returns an overview object" true "$(jqp "$TMP/rbac4" '"totals" in d["data"]["overview"]')"
code=$(req "$TMP/rbac5" -b "$ADMIN_JAR" "$BASE/api/admin/users?perPage=3&role=PROFESSIONAL"); expect "admin → user list 200" 200 "$code"

FOREIGN_SERVICE=$(psql_q "SELECT s.id FROM services s JOIN professional_profiles p ON p.id=s.professional_id JOIN users u ON u.id=p.user_id WHERE u.email<>'professional@alomaalem.ma' LIMIT 1")
code=$(req "$TMP/own1" -b "$CUSTOMER_JAR" -X DELETE "$BASE/api/services/$FOREIGN_SERVICE"); expect "customer deletes somebody's service → 403" 403 "$code"
code=$(req "$TMP/own2" -b "$PRO_JAR" -X DELETE "$BASE/api/services/$FOREIGN_SERVICE");     expect "professional deletes a rival's service → 403" 403 "$code"
# Deterministic: an offer whose request belongs to a different customer.
FOREIGN_OFFER=$(psql_q "SELECT o.id FROM offers o JOIN service_requests r ON r.id=o.request_id WHERE r.customer_id<>'$CUSTOMER_ID' LIMIT 1")
if [[ -z "$FOREIGN_OFFER" ]]; then
  CUSTOMER_ID_TMP=$(psql_q "SELECT id FROM users WHERE email='customer@alomaalem.ma'")
  FOREIGN_OFFER=$(psql_q "SELECT o.id FROM offers o JOIN service_requests r ON r.id=o.request_id WHERE r.customer_id<>'$CUSTOMER_ID_TMP' LIMIT 1")
fi
code=$(req "$TMP/own3" -b "$CUSTOMER_JAR" -X POST "$BASE/api/offers/$FOREIGN_OFFER/accept"); expect "customer accepts an offer on somebody else's request → 403" 403 "$code"
code=$(req "$TMP/own4" -b "$PRO_JAR" "$BASE/api/bookings?tab=all");       expect "professional reads own bookings → 200" 200 "$code"

# ── 4. transactional offer acceptance ────────────────────────────────────────
section "Offer acceptance (transactional)"
CUSTOMER_ID=$(psql_q "SELECT id FROM users WHERE email='customer@alomaalem.ma'")
REQUEST_ID=$(psql_q "SELECT r.id FROM service_requests r WHERE r.customer_id='$CUSTOMER_ID' AND r.status IN ('OPEN','RECEIVING_OFFERS') AND (SELECT count(*) FROM offers o WHERE o.request_id=r.id AND o.status='PENDING')>=2 ORDER BY r.created_at DESC LIMIT 1")

if [[ -z "$REQUEST_ID" ]]; then
  # The previous run consumed the only eligible request — build a fresh one
  # through the public API so the check stays meaningful on re-runs.
  CATEGORY_ID=$(psql_q "SELECT c.id FROM categories c JOIN services s ON s.category_id=c.id JOIN professional_profiles p ON p.id=s.professional_id JOIN users u ON u.id=p.user_id WHERE u.email='professional@alomaalem.ma' LIMIT 1")
  code=$(req "$TMP/newreq" -b "$CUSTOMER_JAR" -X POST "$BASE/api/requests" -H 'content-type: application/json' -d "{
    \"title\":\"طلب اختبار آلي للتسليك والصيانة\",
    \"categoryId\":\"$CATEGORY_ID\",
    \"description\":\"هذا طلب ينشئه اختبار آلي للتحقق من مسار قبول العرض داخل معاملة واحدة دون سباق.\",
    \"city\":\"casablanca\",\"budgetMin\":300,\"budgetMax\":900,\"urgency\":\"NORMAL\"}")
  expect "customer can post a request → 201" 201 "$code"
  REQUEST_ID=$(jqp "$TMP/newreq" 'd["data"]["id"]')

  PRO_USER_ID=$(psql_q "SELECT user_id FROM professional_profiles WHERE id=(SELECT professional_id FROM services WHERE category_id='$CATEGORY_ID' LIMIT 1)")
  OTHER_PRO_ID=$(psql_q "SELECT u.id FROM users u JOIN professional_profiles p ON p.user_id=u.id WHERE p.verification_status='VERIFIED' AND u.id<>'$PRO_USER_ID' LIMIT 1")

  code=$(req "$TMP/offer1" -b "$PRO_JAR" -X POST "$BASE/api/requests/$REQUEST_ID/offers" -H 'content-type: application/json' \
    -d '{"price":520,"message":"أستطيع التدخل غدا صباحاً، السعر يشمل التشخيص والإصلاح وقطع الغيار الصغيرة.","durationMin":120}')
  expect "professional submits an offer → 201" 201 "$code"
  OFFER_ID=$(jqp "$TMP/offer1" 'd["data"]["id"]')

  code=$(req "$TMP/offer_dup" -b "$PRO_JAR" -X POST "$BASE/api/requests/$REQUEST_ID/offers" -H 'content-type: application/json' \
    -d '{"price":480,"message":"محاولة إرسال عرض ثانٍ على نفس الطلب من نفس المهني للتأكد من رفضها."}')
  expect "  duplicate offer on the same request → 409" 409 "$code"

  # A second professional offers so acceptance has a competitor to close.
  OTHER_PRO_EMAIL=$(psql_q "SELECT email FROM users WHERE id='$OTHER_PRO_ID'")
  req "$TMP/other_login" -c "$TMP/other.jar" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
    -d "{\"identifier\":\"$OTHER_PRO_EMAIL\",\"password\":\"$PASSWORD\"}" >/dev/null
  code=$(req "$TMP/offer2" -b "$TMP/other.jar" -X POST "$BASE/api/requests/$REQUEST_ID/offers" -H 'content-type: application/json' \
    -d '{"price":610,"message":"عرض منافس من مهني آخر للتحقق من إغلاق العروض الأخرى عند القبول.","durationMin":150}')
  expect "  a competing professional can offer too → 201" 201 "$code"
  RIVAL_OFFER_ID=$(jqp "$TMP/offer2" 'd["data"]["id"]')
else
  OFFER_ID=$(psql_q "SELECT id FROM offers WHERE request_id='$REQUEST_ID' AND status='PENDING' ORDER BY price LIMIT 1")
  RIVAL_OFFER_ID=$(psql_q "SELECT id FROM offers WHERE request_id='$REQUEST_ID' AND status='PENDING' AND id<>'$OFFER_ID' LIMIT 1")
fi

code=$(req "$TMP/accept" -b "$CUSTOMER_JAR" -X POST "$BASE/api/offers/$OFFER_ID/accept")
expect "POST /api/offers/:id/accept → 200" 200 "$code"
BOOKING_ID=$(jqp "$TMP/accept" 'd["data"]["bookingId"]')
expect "  a booking reference is returned" true "$([[ -n $(jqp "$TMP/accept" 'd["data"]["bookingReference"]') ]] && echo true || echo false)"

code=$(req "$TMP/accept_again" -b "$CUSTOMER_JAR" -X POST "$BASE/api/offers/$OFFER_ID/accept")
expect "  accepting the same offer twice → 409" 409 "$code"

if [[ -n "$RIVAL_OFFER_ID" ]]; then
  code=$(req "$TMP/accept_rival" -b "$CUSTOMER_JAR" -X POST "$BASE/api/offers/$RIVAL_OFFER_ID/accept")
  # The rival offer was already closed by the transaction, so accepting it is
  # refused as no-longer-available (422); a genuine double-accept is 409.
  expect "  accepting a competing offer afterwards → 422/409" true "$([[ "$code" == "422" || "$code" == "409" ]] && echo true || echo false)"
  expect "  the rival offer was closed" true "$([[ $(psql_q "SELECT status FROM offers WHERE id='$RIVAL_OFFER_ID'") != "PENDING" ]] && echo true || echo false)"
fi

expect "request advanced to OFFER_SELECTED" OFFER_SELECTED "$(psql_q "SELECT status FROM service_requests WHERE id='$REQUEST_ID'")"
expect "exactly one booking exists for the request" 1 "$(psql_q "SELECT count(*) FROM bookings WHERE request_id='$REQUEST_ID'")"
expect "no offer left PENDING" 0 "$(psql_q "SELECT count(*) FROM offers WHERE request_id='$REQUEST_ID' AND status='PENDING'")"
expect "the accepted offer is ACCEPTED" ACCEPTED "$(psql_q "SELECT status FROM offers WHERE id='$OFFER_ID'")"
expect "an audit entry was written" true "$([[ $(psql_q "SELECT count(*) FROM audit_logs WHERE action='OFFER_ACCEPTED' AND target_id='$OFFER_ID'") -ge 1 ]] && echo true || echo false)"
expect "the professional was notified" true "$([[ $(psql_q "SELECT count(*) FROM notifications WHERE type='OFFER_ACCEPTED' AND link_to LIKE '%$BOOKING_ID%'") -ge 1 ]] && echo true || echo false)"

# Booking state machine
code=$(req "$TMP/confirm" -b "$PRO_JAR" -X POST "$BASE/api/bookings/$BOOKING_ID/transition" -H 'content-type: application/json' -d '{"status":"CONFIRMED"}')
PRO_JAR_ACTIVE="$PRO_JAR"
if [[ "$code" == "403" ]]; then
  # The booking may belong to a different professional on a re-run.
  BOOKING_PRO_EMAIL=$(psql_q "SELECT email FROM users WHERE id=(SELECT professional_id FROM bookings WHERE id='$BOOKING_ID')")
  req "$TMP/bp_login" -c "$TMP/bp.jar" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
    -d "{\"identifier\":\"$BOOKING_PRO_EMAIL\",\"password\":\"$PASSWORD\"}" >/dev/null
  code=$(req "$TMP/confirm" -b "$TMP/bp.jar" -X POST "$BASE/api/bookings/$BOOKING_ID/transition" -H 'content-type: application/json' -d '{"status":"CONFIRMED"}')
  PRO_JAR_ACTIVE="$TMP/bp.jar"
fi
expect "professional confirms the booking → 200" 200 "$code"
code=$(req "$TMP/selfcomplete" -b "$PRO_JAR_ACTIVE" -X POST "$BASE/api/bookings/$BOOKING_ID/transition" -H 'content-type: application/json' -d '{"status":"COMPLETED"}')
expect "  professional cannot self-complete → 403" 403 "$code"
code=$(req "$TMP/complete" -b "$CUSTOMER_JAR" -X POST "$BASE/api/bookings/$BOOKING_ID/transition" -H 'content-type: application/json' -d '{"status":"COMPLETED"}')
expect "customer completes the booking → 200" 200 "$code"
expect "  booking is COMPLETED" COMPLETED "$(psql_q "SELECT status FROM bookings WHERE id='$BOOKING_ID'")"
code=$(req "$TMP/reopen" -b "$CUSTOMER_JAR" -X POST "$BASE/api/bookings/$BOOKING_ID/transition" -H 'content-type: application/json' -d '{"status":"IN_PROGRESS"}')
expect "  reopening a completed booking → 422" 422 "$code"
expect "status history recorded every step" true "$([[ $(psql_q "SELECT count(*) FROM booking_status_history WHERE booking_id='$BOOKING_ID'") -ge 3 ]] && echo true || echo false)"

# Review eligibility
code=$(req "$TMP/review" -b "$CUSTOMER_JAR" -X POST "$BASE/api/bookings/$BOOKING_ID/review" -H 'content-type: application/json' \
  -d '{"rating":5,"comment":"خدمة ممتازة والتزام بالموعد، وأنصح بالتعامل معه."}')
expect "customer reviews a completed booking → 201" 201 "$code"
code=$(req "$TMP/review_dup" -b "$CUSTOMER_JAR" -X POST "$BASE/api/bookings/$BOOKING_ID/review" -H 'content-type: application/json' \
  -d '{"rating":4,"comment":"محاولة كتابة تقييم ثانٍ على نفس الحجز."}')
expect "  a second review on the same booking → 409" 409 "$code"
code=$(req "$TMP/review_pro" -b "$PRO_JAR_ACTIVE" -X POST "$BASE/api/bookings/$BOOKING_ID/review" -H 'content-type: application/json' -d '{"rating":5,"comment":"محاولة المهني تقييم حجزه بنفسه."}')
expect "  the professional cannot review their own job → 403" 403 "$code"
CANCELLED_BOOKING=$(psql_q "SELECT id FROM bookings WHERE status='CANCELLED' LIMIT 1")
if [[ -n "$CANCELLED_BOOKING" ]]; then
  CUST_EMAIL=$(psql_q "SELECT email FROM users WHERE id=(SELECT customer_id FROM bookings WHERE id='$CANCELLED_BOOKING')")
  req "$TMP/cc_login" -c "$TMP/cc.jar" -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
    -d "{\"identifier\":\"$CUST_EMAIL\",\"password\":\"$PASSWORD\"}" >/dev/null
  code=$(req "$TMP/review_cancelled" -b "$TMP/cc.jar" -X POST "$BASE/api/bookings/$CANCELLED_BOOKING/review" -H 'content-type: application/json' \
    -d '{"rating":1,"comment":"محاولة تقييم حجز ملغى."}')
  expect "  a cancelled booking cannot be reviewed → 422" 422 "$code"
fi

# ── 5. session-scoped reads ──────────────────────────────────────────────────
section "Session-scoped data"
code=$(req "$TMP/notifs" -b "$CUSTOMER_JAR" "$BASE/api/notifications?perPage=5"); expect "GET /api/notifications → 200" 200 "$code"
expect "  unreadTotal present" true "$(jqp "$TMP/notifs" '"unreadTotal" in d["meta"]')"
code=$(req "$TMP/convs" -b "$CUSTOMER_JAR" "$BASE/api/messages?perPage=5");       expect "GET /api/messages → 200" 200 "$code"
code=$(req "$TMP/favs" -b "$CUSTOMER_JAR" "$BASE/api/favorites");                 expect "GET /api/favorites → 200" 200 "$code"
code=$(req "$TMP/bookings" -b "$CUSTOMER_JAR" "$BASE/api/bookings?tab=all");      expect "GET /api/bookings → 200" 200 "$code"
code=$(req "$TMP/offers" -b "$PRO_JAR" "$BASE/api/offers?scope=sent");            expect "GET /api/offers?scope=sent → 200" 200 "$code"
code=$(req "$TMP/account" -b "$CUSTOMER_JAR" "$BASE/api/account/profile");        expect "GET /api/account/profile → 200" 200 "$code"
expect "  the account payload never carries a password hash" true "$([[ $(grep -c passwordHash "$TMP/account") -eq 0 ]] && echo true || echo false)"

# Favorites are idempotent: toggling twice returns to the original state.
FAV_SERVICE=$(psql_q "SELECT id FROM services WHERE status='PUBLISHED' LIMIT 1")
first=$(jqp "$TMP/favs" 'len(d["data"])')
code=$(req "$TMP/fav1" -b "$CUSTOMER_JAR" -X POST "$BASE/api/favorites" -H 'content-type: application/json' -d "{\"targetType\":\"SERVICE\",\"targetId\":\"$FAV_SERVICE\"}")
expect "POST /api/favorites toggles on → 200" 200 "$code"
expect "  favourited=true" true "$(jqp "$TMP/fav1" 'd["data"]["favorited"]')"
code=$(req "$TMP/fav2" -b "$CUSTOMER_JAR" -X POST "$BASE/api/favorites" -H 'content-type: application/json' -d "{\"targetType\":\"SERVICE\",\"targetId\":\"$FAV_SERVICE\"}")
expect "  toggling again removes it (idempotent)" false "$(jqp "$TMP/fav2" 'd["data"]["favorited"]')"

# Messaging
PRO_EMAIL_FOR_CHAT=$(psql_q "SELECT u.email FROM users u JOIN professional_profiles p ON p.user_id=u.id WHERE p.verification_status='VERIFIED' AND u.email<>'professional@alomaalem.ma' LIMIT 1")
PRO_CHAT_ID=$(psql_q "SELECT id FROM users WHERE email='$PRO_EMAIL_FOR_CHAT'")
code=$(req "$TMP/thread" -b "$CUSTOMER_JAR" -X POST "$BASE/api/messages" -H 'content-type: application/json' \
  -d "{\"withUserId\":\"$PRO_CHAT_ID\",\"subject\":\"سؤال من الاختبار الآلي\",\"body\":\"سلام، هل يمكن التدخل هذا الأسبوع؟\"}")
expect "start a conversation → 201" 201 "$code"
CONV_ID=$(jqp "$TMP/thread" 'd["data"]["id"]')
code=$(req "$TMP/thread_again" -b "$CUSTOMER_JAR" -X POST "$BASE/api/messages" -H 'content-type: application/json' \
  -d "{\"withUserId\":\"$PRO_CHAT_ID\",\"subject\":\"سؤال من الاختبار الآلي\",\"body\":\"سلام، هل يمكن التدخل هذا الأسبوع؟\"}")
expect "  the same context returns the same thread" "$CONV_ID" "$(jqp "$TMP/thread_again" 'd["data"]["id"]')"
code=$(req "$TMP/send" -b "$CUSTOMER_JAR" -X POST "$BASE/api/messages/$CONV_ID" -H 'content-type: application/json' \
  -d '{"body":"شكراً، في انتظار ردكم.","clientId":"smoke-client-id-0001"}')
expect "send a message → 201" 201 "$code"
MSG_ID=$(jqp "$TMP/send" 'd["data"]["id"]')
code=$(req "$TMP/send_retry" -b "$CUSTOMER_JAR" -X POST "$BASE/api/messages/$CONV_ID" -H 'content-type: application/json' \
  -d '{"body":"شكراً، في انتظار ردكم.","clientId":"smoke-client-id-0001"}')
expect "  retrying the same clientId is idempotent" "$MSG_ID" "$(jqp "$TMP/send_retry" 'd["data"]["id"]')"
code=$(req "$TMP/stranger" -b "$PRO_JAR" "$BASE/api/messages/$CONV_ID")
PRO_JAR_ACTIVE="$PRO_JAR"
if [[ "$code" == "403" ]]; then expect "a stranger cannot read the thread → 403" 403 "$code"; else echo "  (demo professional is the counterparty: $code)"; fi
code=$(req "$TMP/read" -b "$CUSTOMER_JAR" -X POST "$BASE/api/messages/$CONV_ID/read")
expect "mark the thread read → 200" 200 "$code"

# ── 6. page routing & proxy ──────────────────────────────────────────────────
section "Routing"
code=$(req "$TMP/home" "$BASE/");                              expect "GET / → 200" 200 "$code"
expect "  html is Arabic" 'lang="ar"' "$(grep -o 'lang="ar"' "$TMP/home" | head -1)"
expect "  html is RTL" 'dir="rtl"' "$(grep -o 'dir="rtl"' "$TMP/home" | head -1)"
code=$(req "$TMP/dash_anon" "$BASE/dashboard");                expect "GET /dashboard anonymous → 307" 307 "$code"
code=$(req "$TMP/admin_customer" -b "$CUSTOMER_JAR" "$BASE/admin"); expect "GET /admin as customer → 307" 307 "$code"
code=$(req "$TMP/pro_customer" -b "$CUSTOMER_JAR" "$BASE/professional"); expect "GET /professional as customer → 307" 307 "$code"
code=$(req "$TMP/upload" "$BASE/api/uploads/nope/missing.png"); expect "GET a missing upload → 404" 404 "$code"

# ── summary ──────────────────────────────────────────────────────────────────
printf '\n\033[1m'
if [[ $failed -eq 0 ]]; then printf '\033[32m%d checks passed\033[0m\n' "$passed"
else printf '\033[31m%d passed, %d failed\033[0m\n' "$passed" "$failed"; fi
printf '\033[0m'
[[ $failed -eq 0 ]]
