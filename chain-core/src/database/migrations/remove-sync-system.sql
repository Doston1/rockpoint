-- Migration to remove the automatic sync system
-- Run this to clean up existing sync_tasks and sync_history tables

-- Drop the sync tables and related objects
DROP TRIGGER IF EXISTS update_sync_tasks_updated_at ON sync_tasks;
DROP INDEX IF EXISTS idx_sync_tasks_task_type;
DROP INDEX IF EXISTS idx_sync_tasks_branch_id;
DROP INDEX IF EXISTS idx_sync_tasks_status;
DROP INDEX IF EXISTS idx_sync_tasks_is_active;
DROP INDEX IF EXISTS idx_sync_tasks_next_run;

DROP INDEX IF EXISTS idx_sync_history_task_id;
DROP INDEX IF EXISTS idx_sync_history_entity_type;
DROP INDEX IF EXISTS idx_sync_history_sync_status;
DROP INDEX IF EXISTS idx_sync_history_started_at;

DROP TABLE IF EXISTS sync_history CASCADE;
DROP TABLE IF EXISTS sync_tasks CASCADE;

-- Note: oneC_sync_logs table is kept for 1C integration logging
