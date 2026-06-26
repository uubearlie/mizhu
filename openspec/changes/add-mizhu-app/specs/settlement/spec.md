# 大套购结算

## 需求

支持活动级别的大套购返现手动结算，支持分批结算和全部结算，支持整批撤销。

## 规格说明

### 大套购规则配置

- 活动创建时配置，默认带出全局默认值：[3000→100, 5000→200, 10000→500]
- 每期可修改，支持添加/删除档位
- 档位由"满XX返YY"组成

### 预估机制

- 商品创建时自动生成 CashbackEntry(type='big_purchase', amount=price×0.05, isEstimated=true, dueDate=null)
- 预估比例 0.05 为固定常量，写死在代码中
- 预估完全独立，不依赖其他订单状态
- 预估 Entry 参与到手价和待返金额的计算（迷住侧合计自动包含）

### 结算流程

**选择订单：**
- 仅显示 big_purchase Entry 的 isEstimated=true 且 Item 非已取消的订单
- 用户勾选要结算的订单
- 实时计算本批总额和预览返现

**预览计算：**
- 本批总额 = Σ(选中订单的实付金额)
- 按分档拆分算法计算返现
- 展示每个订单的分摊金额

**确认结算：**
- 生成本批次 SettlementBatch（结算日期、包含订单、总额、返现、分摊明细）
- 每个订单的 big_purchase Entry.amount 更新为实际分摊值
- 每个订单的 big_purchase Entry.isEstimated → false
- 每个订单自动生成 PaymentRecord(payer='迷住', amount=实际分摊)
- 已结算订单从选择列表中移除

**全部结算：**
- 自动全选所有未结算订单
- 其余流程同确认结算

### 撤销结算

- 只支持整批撤销，不支持单件撤销
- 撤销后每个订单：
  - big_purchase Entry.amount 回退为 price × 0.05
  - big_purchase Entry.isEstimated → true
  - 对应 PaymentRecord 删除
- 被撤销的订单回到未结算列表
- 如果撤销导致订单待返 > 0 且当前为已完成，状态回退到待返现

### 结算记录查看

- 展示所有历史结算批次
- 可展开查看各订单分摊明细
- 每批可单独撤销
