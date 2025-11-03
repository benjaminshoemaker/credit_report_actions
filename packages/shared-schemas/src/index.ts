import { z } from 'zod';

export { z };

export const BureauSchema = z.enum(['equifax', 'experian', 'transunion', 'unknown']);
export type Bureau = z.infer<typeof BureauSchema>;

export const ScoreBandSchema = z.enum([
  'unknown',
  'excellent',
  'very_good',
  'good',
  'fair',
  'poor'
]);
export type ScoreBand = z.infer<typeof ScoreBandSchema>;

export const ProductTypeSchema = z.enum([
  'credit_card',
  'charge_card',
  'personal_loan',
  'auto_loan',
  'student_loan',
  'mortgage',
  'home_equity',
  'secured_card',
  'other'
]);
export type ProductType = z.infer<typeof ProductTypeSchema>;

export const OwnershipSchema = z.enum([
  'individual',
  'joint',
  'authorized_user',
  'business',
  'unknown'
]);
export type Ownership = z.infer<typeof OwnershipSchema>;

export const StatusSchema = z.enum([
  'open',
  'closed',
  'paid',
  'delinquent',
  'charged_off',
  'collection',
  'unknown'
]);
export type Status = z.infer<typeof StatusSchema>;

export const PaymentStatusSchema = z.enum([
  'current',
  'late_30',
  'late_60',
  'late_90_plus',
  'derogatory',
  'unknown'
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const LimitSourceSchema = z.enum([
  'reported_limit',
  'high_credit_proxy',
  'unknown'
]);
export type LimitSource = z.infer<typeof LimitSourceSchema>;

export const InquiryTypeSchema = z.enum(['hard', 'soft', 'unknown']);
export type InquiryType = z.infer<typeof InquiryTypeSchema>;

export const AccountSchema = z.object({
  id: z.string().min(1),
  bureau: BureauSchema,
  creditorName: z.string().min(1),
  productType: ProductTypeSchema,
  ownership: OwnershipSchema,
  status: StatusSchema,
  paymentStatus: PaymentStatusSchema,
  balance: z.number().nonnegative(),
  creditLimit: z.number().nonnegative().nullable().optional(),
  highCredit: z.number().nonnegative().nullable().optional(),
  limitSource: LimitSourceSchema.default('unknown'),
  apr: z.number().nonnegative().nullable().optional(),
  aprSource: z.enum(['reported', 'estimated', 'none', 'unknown']).default('unknown'),
  openDate: z.string().optional(),
  lastDelinquencyDate: z.string().optional(),
  reportedMonth: z.string().optional(),
  disputeCandidate: z.boolean().default(false),
  disputeReasons: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([])
});
export type Account = z.infer<typeof AccountSchema>;

export const InquirySchema = z.object({
  id: z.string().min(1),
  bureau: BureauSchema,
  creditorName: z.string().min(1),
  type: InquiryTypeSchema,
  date: z.string().min(1)
});
export type Inquiry = z.infer<typeof InquirySchema>;

export const UserSchema = z.object({
  id: z.string().min(1),
  scoreBand: ScoreBandSchema,
  email: z.string().email().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  selfReportedScore: z.number().int().min(300).max(850).optional()
});
export type User = z.infer<typeof UserSchema>;

export const AnalyzeMetaSchema = z
  .object({
    source: z.enum(['upload', 'manual', 'reanalysis']).optional(),
    bureaus: z.array(BureauSchema).min(1).optional(),
    generatedAt: z.string().optional(),
    version: z.string().optional()
  })
  .partial();
export type AnalyzeMeta = z.infer<typeof AnalyzeMetaSchema>;

export const AnalyzeFlagsSchema = z
  .object({
    any60dLate: z.boolean().optional(),
    lateFeeLastTwoStatements: z.boolean().optional(),
    penaltyAprActive: z.boolean().optional()
  })
  .partial();
export type AnalyzeFlags = z.infer<typeof AnalyzeFlagsSchema>;

export const AnalyzeInputSchema = z.object({
  user: UserSchema,
  accounts: z.array(AccountSchema),
  inquiries: z.array(InquirySchema).default([]),
  meta: AnalyzeMetaSchema.optional(),
  flags: AnalyzeFlagsSchema.optional()
});
export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>;

export const ScoreImpactSchema = z.enum(['low', 'medium', 'high']);
export type ScoreImpact = z.infer<typeof ScoreImpactSchema>;

export const ActionMetadataSchema = z.object({
  cashNeededUsd: z.number().nonnegative().optional(),
  timeToEffectMonths: z.number().nonnegative().optional(),
  scoreImpact: ScoreImpactSchema.optional(),
  whyThis: z.array(z.string()).optional()
});
export type ActionMetadata = z.infer<typeof ActionMetadataSchema>;

export const ActionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'apr_reduction',
    'balance_transfer',
    'late_fee_reversal',
    'penalty_apr_reduction',
    'pay_down',
    'dispute',
    'education'
  ]),
  title: z.string().min(1),
  summary: z.string().min(1),
  estimatedSavingsUsd: z.number(),
  probabilityOfSuccess: z.number().min(0).max(1).nullable().optional(),
  scenarioRange: z
    .object({
      low: z.number(),
      high: z.number()
    })
    .optional(),
  nextSteps: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  metadata: ActionMetadataSchema.optional()
});
export type Action = z.infer<typeof ActionSchema>;

export const WarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  level: z.enum(['info', 'warning', 'error']).default('warning')
});
export type Warning = z.infer<typeof WarningSchema>;

export const AuditSchema = z.object({
  engineVersion: z.string().min(1),
  computeMs: z.number().nonnegative(),
  runId: z.string().optional(),
  generatedAt: z.string().optional()
});
export type Audit = z.infer<typeof AuditSchema>;

export const AnalyzeOutputSchema = z.object({
  actions: z.array(ActionSchema),
  warnings: z.array(WarningSchema),
  audit: AuditSchema
});
export type AnalyzeOutput = z.infer<typeof AnalyzeOutputSchema>;

export const parseUser = (input: unknown): User => UserSchema.parse(input);
export const parseAnalyzeInput = (input: unknown): AnalyzeInput =>
  AnalyzeInputSchema.parse(input);
export const parseAnalyzeOutput = (input: unknown): AnalyzeOutput =>
  AnalyzeOutputSchema.parse(input);
