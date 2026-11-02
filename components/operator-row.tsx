'use client';

import type {ReactNode} from 'react';

type OperatorRowProps={
  title:ReactNode;
  secondary?:ReactNode;
  status?:ReactNode;
  meta?:ReactNode;
  actions?:ReactNode;
  children?:ReactNode;
  className?:string;
};

export function OperatorRow({title,secondary,status,meta,actions,children,className=''}:OperatorRowProps){
  return <article className={`operator-row ${className}`.trim()}>
    <div className="operator-row-main">
      <div className="operator-row-heading"><h3>{title}</h3>{status&&<span className="operator-row-status">{status}</span>}</div>
      {secondary&&<p className="operator-row-secondary">{secondary}</p>}
      {meta&&<div className="operator-row-meta">{meta}</div>}
    </div>
    {actions&&<div className="operator-row-actions">{actions}</div>}
    {children&&<div className="operator-row-extra">{children}</div>}
  </article>;
}
