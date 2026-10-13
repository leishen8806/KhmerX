// Split migration SQL without treating CASE ... END as a trigger block.
// SQLite trigger bodies use BEGIN ... END; CASE expressions may be nested
// inside them and must not close the outer statement.
export function splitSql(sql){
 const statements=[];
 const push=current=>{const text=current.trim();if(text&&text.replace(/--[^\n]*/g,'').trim())statements.push(text)};
 let current='',quote=false,blockDepth=0,caseDepth=0;
 const wordAt=i=>{const before=i===0?'':sql[i-1],m=sql.slice(i).match(/^[A-Za-z]+/),after=m?sql[i+(m[0].length)]:'';if(!m||/[A-Za-z0-9_]/.test(before)||/[A-Za-z0-9_]/.test(after))return '';return m[0].toUpperCase()};
 for(let i=0;i<sql.length;i++){
  const ch=sql[i];
  if(ch==="'"){if(quote&&sql[i+1]==="'"){current+=ch+sql[++i];continue}quote=!quote;current+=ch;continue}
  if(!quote){
   const word=wordAt(i);
   if(word==='BEGIN'){blockDepth++;current+=word;i+=word.length-1;continue}
   if(word==='CASE'){caseDepth++;current+=word;i+=word.length-1;continue}
   if(word==='END'){if(caseDepth>0)caseDepth--;else blockDepth=Math.max(0,blockDepth-1);current+=word;i+=word.length-1;continue}
  }
  if(ch===';'&&!quote&&blockDepth===0&&caseDepth===0){push(current);current='';continue}
  current+=ch;
 }
 push(current);return statements;
}
