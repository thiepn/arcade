-- Archive retired Gravity / Astro Blaster leaderboard data at the production
-- cutover where their AP slots became Vector Golf / Hex Capture. The AP policy,
-- game IDs, anchors, and 32-game denominator are intentionally unchanged.

insert into public.micro_arcade_lb_reviews (run_id, previous_status, new_status, reason, reviewed_at)
select r.id, r.status, 'rejected', 'Retired game result archived at Vector Golf / Hex Capture replacement cutover', 1789128215000
from public.micro_arcade_lb_runs r
where r.game_id in ('gravity','astroblaster')
  and r.completed_at < 1789128215000
  and r.status <> 'rejected'
  and not exists (
    select 1
    from public.micro_arcade_lb_reviews v
    where v.run_id = r.id
      and v.reason = 'Retired game result archived at Vector Golf / Hex Capture replacement cutover'
  );

update public.micro_arcade_lb_runs
set status = 'rejected', code = 'retired_game_epoch'
where game_id in ('gravity','astroblaster')
  and completed_at < 1789128215000
  and (status <> 'rejected' or code is distinct from 'retired_game_epoch');

-- Any unused session issued for the retired games could otherwise be submitted
-- later by an old cached client and appear as a replacement-game score.
delete from public.micro_arcade_lb_sessions
where game_id in ('gravity','astroblaster')
  and issued_at < 1789128215000
  and used_at is null;
