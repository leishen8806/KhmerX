-- Remove credentials created by the retired hard-coded UAT migration.
DELETE FROM team_staff_credentials WHERE member_id IN (
 SELECT m.id FROM team_members m JOIN team_companies c ON c.id=m.tenant_id
 WHERE c.slug IN ('uat-company-a','uat-company-b')
   AND lower(m.email)='zhangdaowang3@gmail.com'
);
DELETE FROM team_audit WHERE action='enable_admin_password'
 AND detail LIKE '%zhangdaowang3@gmail.com%';
