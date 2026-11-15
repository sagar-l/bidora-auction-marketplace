-- Run after deploying the `auction-agent` Supabase Edge Function and enabling
-- pg_net. Replace both placeholders. Use the same private random secret as the
-- Edge Function's BIDORA_AGENT_SECRET. Never use a publishable key here.
-- Safe to rerun: only this agent's Vault entries and scheduled job are replaced.
delete from vault.secrets
where name in ('bidora_agent_project_url', 'bidora_agent_secret');

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'bidora_agent_project_url'
);

select vault.create_secret(
  'PASTE_THE_SAME_PRIVATE_BIDORA_AGENT_SECRET_HERE',
  'bidora_agent_secret'
);

select cron.unschedule(jobid)
from cron.job
where jobname = 'bidora-auction-agent-payment-links';

select cron.schedule(
  'bidora-auction-agent-payment-links',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'bidora_agent_project_url') || '/functions/v1/auction-agent',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-bidora-agent-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'bidora_agent_secret')
      ),
      body := jsonb_build_object('scheduled_at', now()),
      timeout_milliseconds := 20000
    );
  $$
);
