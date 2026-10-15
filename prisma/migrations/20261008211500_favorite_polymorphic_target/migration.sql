-- `favorites.target_id` is polymorphic: it stores a `services.id` when
-- target_type = 'SERVICE' and a `professional_profiles.id` when it is
-- 'PROFESSIONAL'. The original FK to services(id) rejected every professional
-- favorite and cascade-deleted favorites when a service was removed, so it is
-- dropped. Referential integrity for favorites is enforced in the service
-- layer (`server/favorites/service.ts`), which validates the target before
-- insert.
ALTER TABLE "favorites" DROP CONSTRAINT IF EXISTS "favorites_target_id_fkey";
