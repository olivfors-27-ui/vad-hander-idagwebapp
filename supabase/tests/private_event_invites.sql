begin;

-- Run with: supabase test db. Everything rolls back, including the fixture.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'invite-owner@example.test', '', now(), '{}', '{}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'invite-guest@example.test', '', now(), '{}', '{}', now(), now());

insert into public.private_events (id, invite_code, organizer_id, payload)
values ('invite-test', 'TESTCODE9', '11111111-1111-4111-8111-111111111111',
        '{"id":"invite-test","name":"Test event","category":"fest","date":"2099-01-01","start":"20:00","end":"23:00","place":"Test","address":"Test","price":0,"description":"","organizerId":"11111111-1111-4111-8111-111111111111","organizerName":"Host","interested":[],"visibility":"private","status":"approved","distance":0,"inviteCode":"TESTCODE9"}');

create temporary table guest_tokens (token text);
create temporary table guest_two_tokens (token text);
grant select, insert on guest_tokens, guest_two_tokens to anon;

set local role anon;
select plan(19);
select is(public.get_private_event_invite('NO-SUCH-CODE', null), null::jsonb, 'invalid invite code yields no event');
select is(public.get_private_event_invite('TESTCODE9', null)->'ownReply', null::jsonb, 'invite link alone does not reveal replies');

-- First guest has no token: the database issues one, while storing only its digest.
insert into guest_tokens
select public.reply_to_private_event_invite('TESTCODE9', null, 'Guest One', 'accepted')->>'responseToken';
select ok((select token ~ '^[0-9a-f]{64}$' from guest_tokens), 'new response token has 256 bits of hex entropy');
set local role postgres;
select is((select count(*)::int from public.private_event_replies where event_id = 'invite-test' and response_token_hash = digest((select token from guest_tokens), 'sha256')), 1, 'only token digest is stored');
set local role anon;
select is(public.get_private_event_invite('TESTCODE9', (select token from guest_tokens))->'ownReply'->>'name', 'Guest One', 'token reads only its own reply');
select throws_ok($$select public.reply_to_private_event_invite('TESTCODE9', repeat('0', 64), 'Attacker', 'declined')$$, '42501', 'invalid token cannot create or alter a reply');

insert into guest_two_tokens
select public.reply_to_private_event_invite('TESTCODE9', null, 'Guest Two', 'maybe')->>'responseToken';
select is(public.get_private_event_invite('TESTCODE9', (select token from guest_two_tokens))->'ownReply'->>'name', 'Guest Two', 'second token reads second guest reply');
select is(public.get_private_event_invite('TESTCODE9', (select token from guest_two_tokens))->'ownReply'->>'userId',
          (public.reply_to_private_event_invite('TESTCODE9', (select token from guest_tokens), 'Guest One', 'declined')->'reply'->>'userId'),
          'using guest one token updates same reply and cannot select guest two');
select is(public.get_private_event_invite('TESTCODE9', (select token from guest_two_tokens))->'ownReply'->>'status', 'maybe', 'guest one update leaves guest two RSVP unchanged');
select is(public.get_private_event_invite('TESTCODE9', repeat('0', 64))->'ownReply', null::jsonb, 'valid-shape but unknown token reads no reply');
select is(public.get_private_event_invite('TESTCODE9', 'browser-key')->'ownReply', null::jsonb, 'malformed token reads no reply');
select throws_ok($$select public.list_private_event_invites('TESTCODE9')$$, '42501', 'anonymous caller cannot read guest list');
select throws_ok($$select public.reply_to_private_event_invite('TESTCODE9', 'browser-key', 'Attacker', 'declined')$$, '42501', 'client-chosen token is rejected');
select throws_ok($$select public.reply_to_private_event_invite('TESTCODE9', null, '   ', 'declined')$$, '22023', 'empty guest name is rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(public.get_private_event_invite('TESTCODE9', null)->'ownReply', null::jsonb, 'non-owner account cannot read reply data');
select throws_ok($$select public.list_private_event_invites('TESTCODE9')$$, '42501', 'another account cannot read guest list');
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(jsonb_array_length(public.list_private_event_invites('TESTCODE9')), 2, 'organizer sees all replies');
select is(public.get_private_event_invite('TESTCODE9', null)->'ownReply', null::jsonb, 'organizer does not inherit guest identity');
select is((public.get_private_event_invite('TESTCODE9', null)->'event'->>'id'), 'invite-test', 'organizer can still load their event');

select * from finish();
rollback;
