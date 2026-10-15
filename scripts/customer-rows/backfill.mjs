import { args, db, ensureReport, parsePayload, shard, workspaces, ref } from './common.mjs';

export function backfill(database, { tenant, batchSize=50, dryRun=false }={}){
  const rows=workspaces(database,tenant), report={tenants:rows.length,customers:0,loans:0,skipped:[],dryRun};
  for(let offset=0;offset<rows.length;offset+=Number(batchSize)){
    for(const row of rows.slice(offset,offset+Number(batchSize))){
      const state=parsePayload(row), groups=new Map();
      for(const loan of state.loans||[]){if(!loan.customerId){report.skipped.push({owner:row.owner,loanId:loan.id,reason:'missing customerId'});continue}const list=groups.get(loan.customerId)||[];list.push(loan);groups.set(loan.customerId,list)}
      for(const [customerId,loans] of groups){
        report.customers++;
        const existing=database.prepare('SELECT customer_id FROM customer_workspaces WHERE owner=? AND customer_id=?').get(row.owner,customerId);
        if(existing)continue;
        const value=shard(state,customerId),now=new Date().toISOString();
        for(const loan of loans){if(!loan.publicRef)loan.publicRef=ref('O',loan.sourceChannel||'H5',new Date(loan.createdAt));if(loan.billing&&!loan.billing.publicRef)loan.billing.publicRef=ref('B',loan.sourceChannel||'H5',new Date(loan.createdAt));report.loans++}
        value.loans=loans;
        if(dryRun)continue;
        database.exec('BEGIN');
        try{
          database.prepare('INSERT INTO customer_workspaces(owner,customer_id,revision,payload,updated_at) VALUES(?,?,?,?,?)').run(row.owner,customerId,0,JSON.stringify(value),now);
          for(const loan of loans){database.prepare('INSERT OR IGNORE INTO loan_index(owner,loan_id,customer_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(row.owner,loan.id,customerId,loan.status,loan.createdAt,now)}
          database.exec('COMMIT');
        }catch(error){database.exec('ROLLBACK');throw error}
      }
    }
  }
  return report;
}
if(import.meta.url===`file:///${process.argv[1]?.replace(/\\/g,'/')}`){const a=args();const report=backfill(db(),{tenant:a.tenant,batchSize:a['batch-size']||50,dryRun:a['dry-run']===true});ensureReport(a.report||'scripts/customer-rows/backfill-report.json',report);console.log(report)}
