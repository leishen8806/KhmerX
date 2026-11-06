# 方案 A：机构回调触发放款发起

方案 A 保留双人原则：持牌机构系统负责签名发起，平台 `finance_checker` 负责后台复核。贷款必须先完成 `signed` 和 `approvalCheckedBy`，之后机构发送 `funding.confirmed`，回调只写入 `fundingActor= institution:<机构 id>`、机构出资流水号和审计记录，并标记为等待财务复核。

回调不得修改钱包、余额或账本；资金入账仍由现有 `disburse` 复核动作执行。`disburse_request` 保留以兼容历史数据和接口，但因当前 finance 入口停用，正常链路不依赖它。`finance_checker` 必须是与机构操作人不同的平台员工，并且未经机构确认的贷款没有 `fundingActor`，不能进入 `disburse`。

签名、时间、nonce、幂等键和事件载荷校验先于业务消费。状态、机构分配、审批复核或出资流水号不满足时进入 dead letter；revision conflict 与现有回调消费者一致，单次最多重试 3 次，仍冲突返回 503 并等待后续重试。
