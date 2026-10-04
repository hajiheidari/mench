ALTER TABLE users ADD COLUMN banned_until timestamptz;
ALTER TABLE user_reports ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','dismissed','actioned'));
ALTER TABLE user_reports ADD COLUMN resolved_at timestamptz;
ALTER TABLE user_reports ADD COLUMN resolved_by uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE TABLE admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 subject_id uuid REFERENCES users(id) ON DELETE SET NULL,
 reference_id uuid,
 request_id uuid NOT NULL,
 payload_hash text NOT NULL,
 action text NOT NULL,
 metadata jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,request_id)
);
CREATE FUNCTION protect_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND
 (NEW.actor_id IS NULL OR NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id) AND
 (NEW.subject_id IS NULL OR NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id) AND
 (to_jsonb(NEW)-'actor_id'-'subject_id')=(to_jsonb(OLD)-'actor_id'-'subject_id')
 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'AUDIT_IMMUTABLE';
END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON admin_audit FOR EACH ROW EXECUTE FUNCTION protect_admin_audit();
