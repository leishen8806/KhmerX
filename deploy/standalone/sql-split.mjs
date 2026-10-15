// Split migration SQL without treating CASE ... END as a trigger block.
// SQLite trigger bodies use BEGIN ... END; CASE expressions may be nested
// inside them and must not close the outer statement.
export function splitSql(sql){
 const statements=[];
 const push=current=>{const text=current.trim();if(text&&text.replace(/--[^\n]*/g,'').trim())statements.push(text)};
 let current='',quote=false,blockDepth=0,caseDepth=0,lineComment=false,commentBlock=false;
 const wordAt=i=>{const before=i===0?'':sql[i-1],m=sql.slice(i).match(/^[A-Za-z]+/),after=m?sql[i+(m[0].length)]:'';if(!m||/[A-Za-z0-9_]/.test(before)||/[A-Za-z0-9_]/.test(after))return '';return m[0].toUpperCase()};
 for(let i=0;i<sql.length;i++){
  const ch=sql[i];
  if(lineComment){
   if(ch==='\n')lineComment=false;
   if(ch==='\n')current+=ch;
   continue;
  }
  if(commentBlock){
   if(ch==='*'&&sql[i+1]==='/'){current+=' ';i++;commentBlock=false}else if(ch==='\n')current+='\n';
   continue;
  }
  if(ch==="'"){if(quote&&sql[i+1]==="'"){current+=ch+sql[++i];continue}quote=!quote;current+=ch;continue}
  if(!quote){
   if(ch==='-'&&sql[i+1]==='-'){current+='  ';i++;lineComment=true;continue}
   if(ch==='/'&&sql[i+1]==='*'){current+='  ';i++;commentBlock=true;continue}
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
