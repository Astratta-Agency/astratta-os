-- The frontend's PostStatus type (src/lib/post-states.ts) has always included
-- "idea" and "changes_requested" as valid statuses (they're in POST_STATE_META,
-- POST_STATE_TRANSITIONS, and the calendar's "Cambiar estado" dropdown), but the
-- post_status enum in the database was created without them. Any attempt to set
-- a post to either of these statuses fails with:
--   invalid input value for enum post_status: "changes_requested"
-- Adding both values in the correct pipeline order.
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'idea' BEFORE 'draft';
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'changes_requested' AFTER 'pending_approval';
