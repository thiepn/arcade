"""Generate the SQL policy from the reviewed immutable JSON; --check is used by CI."""
import pathlib,json,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
p=json.loads((root/'shared/leaderboard/policy.json').read_text())
h=p.pop('policyId'); assert hashlib.sha256(json.dumps(p,sort_keys=True,separators=(',',':')).encode()).hexdigest()==h
p['policyId']=h
insert="INSERT INTO public.micro_arcade_lb_policy VALUES(3,'%s'::jsonb) ON CONFLICT DO NOTHING;\nDO $$ BEGIN IF (SELECT payload->>'policyId' FROM public.micro_arcade_lb_policy WHERE version=3)<>'%s' THEN RAISE EXCEPTION 'Policy 3 is immutable; use a new rating version'; END IF; END $$;"%(json.dumps(p,separators=(',',':')).replace("'","''"),h)
text=(root/'tools/leaderboard/schema.sql').read_text().replace('-- POLICY_INSERT',insert)
path=root/'supabase/migrations/20260910_leaderboard_v3.sql'
if '--check' in sys.argv:
 assert path.read_text()==text,'generated migration is out of date'
else: path.write_text(text)
print('Leaderboard policy/SQL agreement:',h)
