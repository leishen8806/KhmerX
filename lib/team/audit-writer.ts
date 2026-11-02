export type AuditDb = {prepare(sql:string): any};

/** Shared append-only audit writer. The caller may add a changes() guard. */
export function auditInsertSql(database:AuditDb,tenant:string,actor:string,action:string,detail:unknown,id=crypto.randomUUID(),where='1=1',createdAt=new Date().toISOString(),whereArgs:unknown[]=[]){
  const encoded=typeof detail==='string'?detail:JSON.stringify(detail);
  return database.prepare(`INSERT INTO team_audit (id,seq,tenant_id,actor,action,detail,created_at) SELECT ?,COALESCE((SELECT MAX(seq) FROM team_audit),0)+1,?,?,?,?,? WHERE ${where}`).bind(id,tenant,actor,action,encoded,createdAt,...whereArgs);
}
