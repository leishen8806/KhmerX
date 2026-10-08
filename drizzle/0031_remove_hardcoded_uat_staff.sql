DELETE FROM team_staff_credentials WHERE member_id IN ('uat-lender:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b','uat-checker:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b');
DELETE FROM team_staff_sessions WHERE member_id IN ('uat-lender:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b','uat-checker:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b');
DELETE FROM team_assignments WHERE reviewer_id IN ('uat-lender:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b','uat-checker:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b');
DELETE FROM team_invites WHERE issuer IN ('uat-lender:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b','uat-checker:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b');
DELETE FROM team_members WHERE id IN ('uat-lender:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b','uat-checker:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b');
DELETE FROM team_units WHERE id='uat-approval:t_4f171bc0-6b90-48ef-b82b-d7f93ef73e1b';
