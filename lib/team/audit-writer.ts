export type AuditDb = {prepare(sql:string): any};
export type AuditWhere = 'always'|'changed'|'changed-positive'|'tenant-exists';

/** Shared append-only audit writer. The caller may add a changes() guard. */
export function auditInsertSql(database:AuditDb,tenant:string,actor:string,action:string,detail:unknown,id=crypto.randomUUID(),where:AuditWhere='always',createdAt=new Date().toISOString()){
  const encoded=typeof detail==='string'?detail:JSON.stringify(detail);
  const guards:Record<AuditWhere,string>={always:'1=1',changed:'changes()=1','changed-positive':'changes()>0','tenant-exists':'EXISTS (SELECT 1 FROM team_companies WHERE id=? AND active=1)'};
  const sql=guards[where];
  const args=where==='tenant-exists'?[id,tenant,actor,action,encoded,createdAt,tenant]:[id,tenant,actor,action,encoded,createdAt];
  return database.prepare(`INSERT INTO team_audit (id,seq,tenant_id,actor,action,detail,created_at) SELECT ?,COALESCE((SELECT MAX(seq) FROM team_audit),0)+1,?,?,?,?,? WHERE ${sql}`).bind(...args);
}
