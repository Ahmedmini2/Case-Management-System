-- Replaces the stages on the default pipeline with the 7 CaseStatus values,
-- in funnel order, then re-assigns every case to the stage matching its current status.
-- Run once in Supabase SQL Editor.

DO $$
DECLARE pid text;
BEGIN
  SELECT id INTO pid FROM pipelines WHERE "isDefault" = true LIMIT 1;
  IF pid IS NULL THEN
    -- Fall back to the oldest pipeline if no default is set.
    SELECT id INTO pid FROM pipelines ORDER BY "createdAt" LIMIT 1;
  END IF;
  IF pid IS NULL THEN
    RAISE EXCEPTION 'No pipelines exist. Create one in Settings → Pipelines first.';
  END IF;

  -- Disconnect cases from existing stages so we can drop them.
  UPDATE cases SET "pipelineStageId" = NULL
    WHERE "pipelineStageId" IN (SELECT id FROM pipeline_stages WHERE "pipelineId" = pid);

  DELETE FROM pipeline_stages WHERE "pipelineId" = pid;

  INSERT INTO pipeline_stages (id, "pipelineId", name, color, position, "isTerminal") VALUES
    (gen_random_uuid()::text, pid, 'Open',                  '#3b82f6', 0, false),
    (gen_random_uuid()::text, pid, 'In Progress',           '#0ea5e9', 1, false),
    (gen_random_uuid()::text, pid, 'Waiting on Customer',   '#f59e0b', 2, false),
    (gen_random_uuid()::text, pid, 'Waiting on Third Party','#a855f7', 3, false),
    (gen_random_uuid()::text, pid, 'Resolved',              '#22c55e', 4, false),
    (gen_random_uuid()::text, pid, 'Closed',                '#6b7280', 5, true),
    (gen_random_uuid()::text, pid, 'Cancelled',             '#ef4444', 6, true);

  -- Re-link every case to the stage matching its status.
  UPDATE cases c
  SET "pipelineId" = pid,
      "pipelineStageId" = s.id
  FROM pipeline_stages s
  WHERE s."pipelineId" = pid
    AND s.position = CASE c.status::text
      WHEN 'OPEN' THEN 0
      WHEN 'IN_PROGRESS' THEN 1
      WHEN 'WAITING_ON_CUSTOMER' THEN 2
      WHEN 'WAITING_ON_THIRD_PARTY' THEN 3
      WHEN 'RESOLVED' THEN 4
      WHEN 'CLOSED' THEN 5
      WHEN 'CANCELLED' THEN 6
    END;
END $$;
