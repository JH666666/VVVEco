import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata = {
  title: 'VVVEco Whitepaper — Decentralized Staking Protocol',
  description:
    'The official VVVEco technical whitepaper covering token economics, smart-contract architecture, staking mechanics, and team reward distribution.',
}

const TOC = [
  { id: 'abstract', label: 'Abstract' },
  { id: 'introduction', label: '1. Introduction' },
  { id: 'token', label: '2. Token Economics' },
  { id: 'architecture', label: '3. Technical Architecture' },
  { id: 'staking', label: '4. Staking Mechanism' },
  { id: 'rewards', label: '5. Reward Distribution' },
  { id: 'security', label: '6. Security' },
  { id: 'roadmap', label: '7. Roadmap' },
  { id: 'contracts', label: '8. Contract Addresses' },
]

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
          <span className="text-sm font-semibold tracking-wide text-primary">VVVEco</span>
          <a
            href="https://github.com/jh666666/vvveco"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:flex lg:gap-12 lg:py-16">
        {/* Sidebar TOC — desktop only */}
        <aside className="hidden lg:block lg:w-52 lg:shrink-0">
          <div className="sticky top-24">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contents</p>
            <nav className="space-y-1">
              {TOC.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <article className="min-w-0 flex-1 space-y-12">

          {/* Cover */}
          <div className="space-y-4 border-b border-border pb-10">
            <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Technical Whitepaper · v1.0
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">VVVEco Protocol</h1>
            <p className="text-xl text-muted-foreground">
              A Decentralized Dual-Mode Staking Platform on Base
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Published: June 2026</span>
              <span>·</span>
              <span>Chain: Base (Mainnet / Sepolia Testnet)</span>
              <span>·</span>
              <span>Solidity ^0.8.20</span>
            </div>
          </div>

          {/* Abstract */}
          <Section id="abstract" title="Abstract">
            <p>
              VVVEco is a non-custodial, on-chain staking protocol built on the Base L2 network.
              It introduces a <em>dual-mode staking model</em> that lets users choose between{' '}
              <strong>coin-based</strong> (VVV-denominated) and <strong>fiat-based</strong>{' '}
              (USD-denominated) reward accrual within a single contract suite.
              A multi-tier referral tree automatically distributes invite and team bonuses on every
              reward claim, creating a self-reinforcing growth loop without centralised coordination.
            </p>
            <p>
              The protocol separates concerns across four immutable contracts — Staking, Token,
              Treasury, and Payout — minimising attack surface and enabling independent audits per
              component.
            </p>
          </Section>

          {/* Introduction */}
          <Section id="introduction" title="1. Introduction">
            <SubSection title="1.1 Problem">
              <p>
                Existing staking protocols typically lock users into a single reward denomination.
                When token price fluctuates, stakers bear all currency risk with no recourse.
                Meanwhile, referral programmes are often opaque, manually calculated, and
                susceptible to manipulation.
              </p>
            </SubSection>
            <SubSection title="1.2 Solution">
              <p>
                VVVEco solves both issues through:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Dual-mode staking</strong> — coin-based stakes lock a VVV quantity;
                  fiat-based stakes lock a USD-equivalent that is redeemed at the prevailing price,
                  providing stable-value semantics on-chain.
                </li>
                <li>
                  <strong>Automated on-chain referral tree</strong> — invite (3-generation) and
                  team (7-generation compressed) bonuses are computed and paid atomically on every
                  claim, with no off-chain settlement layer.
                </li>
                <li>
                  <strong>Full self-custody</strong> — staked funds flow directly to a project
                  treasury wallet; the protocol never holds user principal.
                </li>
              </ul>
            </SubSection>
          </Section>

          {/* Token Economics */}
          <Section id="token" title="2. Token Economics">
            <SubSection title="2.1 VVV Token">
              <p>
                The native utility token of the protocol is <strong>VVV</strong>, a standard ERC-20
                deployed on Base. It is used as the staking medium, reward currency, and fee
                denomination throughout the protocol.
              </p>
              <Table
                headers={['Property', 'Value']}
                rows={[
                  ['Standard', 'ERC-20 (OpenZeppelin 5.x)'],
                  ['Network', 'Base (L2 on Ethereum)'],
                  ['Decimals', '18'],
                  ['Mintability', 'Owner-controlled'],
                ]}
              />
            </SubSection>
            <SubSection title="2.2 Fee Structure">
              <p>
                A configurable protocol fee (default <strong>10 %</strong>) is deducted from
                personal reward claims and routed to a dedicated fee wallet. Principal redemptions
                and team/invite bonuses are fee-free.
              </p>
            </SubSection>
            <SubSection title="2.3 Capital Flow">
              <CodeBlock>{`STAKE:    User VVV ──transferFrom──▶ Treasury ──swap──▶ ETH ──▶ projectWallet
CLAIM:    Payout ETH ──swap──▶ VVV ──▶ feeWallet (10 %) + User (net)
WITHDRAW: Payout ETH ──swap──▶ VVV ──▶ User (full principal, no fee)`}</CodeBlock>
            </SubSection>
          </Section>

          {/* Architecture */}
          <Section id="architecture" title="3. Technical Architecture">
            <SubSection title="3.1 Contract Suite">
              <p>The protocol is composed of four immutable Solidity contracts:</p>
              <Table
                headers={['Contract', 'Role']}
                rows={[
                  ['VVVToken', 'ERC-20 utility token'],
                  ['VVVEcoStaking', 'Core logic: orders, rewards, referral tree, level system'],
                  ['VVVTreasury', 'Receives staked VVV, converts to ETH, forwards to project wallet'],
                  ['VVVPayout', 'Holds ETH reserve, converts to VVV on demand, pays users & uplines'],
                ]}
              />
            </SubSection>
            <SubSection title="3.2 Web Application Stack">
              <Table
                headers={['Layer', 'Technology']}
                rows={[
                  ['Frontend', 'Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4'],
                  ['Web3', 'Wagmi 3 · RainbowKit 2 · Viem 2 · ethers.js 6'],
                  ['Database', 'Prisma 7 · SQLite (dev) / PostgreSQL (prod)'],
                  ['Admin', 'HMAC-SHA-256 session auth · Next.js API routes'],
                  ['Contracts', 'Hardhat 3 · OpenZeppelin 5 · Solidity 0.8.20'],
                ]}
              />
            </SubSection>
            <SubSection title="3.3 Price Oracle">
              <p>
                Fiat-mode conversions use an on-chain swap router (Uniswap V3 interface) to derive
                the current VVV/ETH price. A <code>MockRouter</code> is provided for testnet
                environments where real liquidity is absent.
              </p>
            </SubSection>
          </Section>

          {/* Staking */}
          <Section id="staking" title="4. Staking Mechanism">
            <SubSection title="4.1 Order Model">
              <p>
                Each staking position is stored as an on-chain <code>Order</code> struct containing:
              </p>
              <Table
                headers={['Field', 'Description']}
                rows={[
                  ['vvvAmountIn', 'Original VVV quantity deposited'],
                  ['usdValue', 'USD-equivalent at stake time (18 dec)'],
                  ['startTime / endTime', 'UNIX timestamps defining the lock window'],
                  ['duration', 'Lock period in days'],
                  ['rate', 'Per-mille daily rate (e.g. 7 = 0.7 %/day)'],
                  ['isCoinBased', 'true = VVV-denominated, false = USD-denominated'],
                  ['isWithdrawn', 'Principal redemption flag'],
                  ['claimedAmount', 'Cumulative rewards paid'],
                ]}
              />
            </SubSection>
            <SubSection title="4.2 Coin-Based Mode">
              <CodeBlock>{`rewards (VVV) = vvvAmountIn × rate × elapsed
                ÷ (1000 × 86400)
redeem         = original vvvAmountIn`}</CodeBlock>
              <p>
                Rewards grow proportionally with VVV holdings. Best suited for users with a
                bullish long-term view on the VVV token.
              </p>
            </SubSection>
            <SubSection title="4.3 Fiat-Based Mode">
              <CodeBlock>{`rewards (USD) = usdValue × rate × elapsed
               ÷ (1000 × 86400)
               → converted to VVV at currentPrice
redeem (VVV)   = usdValue × 1e18 ÷ currentPrice`}</CodeBlock>
              <p>
                USD-pegged mechanics protect principal value from token depreciation; the
                redemption amount adapts to the prevailing VVV price so the staker recovers
                the equivalent USD regardless of market movement.
              </p>
            </SubSection>
          </Section>

          {/* Rewards */}
          <Section id="rewards" title="5. Reward Distribution">
            <SubSection title="5.1 Invite Rewards (3 Generations)">
              <p>
                When a user claims personal rewards, the system walks up three levels of the
                referral tree and distributes bonuses immediately:
              </p>
              <Table
                headers={['Generation', 'Bonus']}
                rows={[
                  ['Generation 1 (direct referrer)', '15 % of claimer\'s gross VVV'],
                  ['Generation 2', '10 % of claimer\'s gross VVV'],
                  ['Generation 3', '5 % of claimer\'s gross VVV'],
                ]}
              />
            </SubSection>
            <SubSection title="5.2 Team Rewards (7 Compressed Generations)">
              <p>
                Beyond invite rewards, a level-based team bonus propagates upward through up to
                seven <em>valid</em> ancestors (ancestors with at least one active, non-expired
                order). The protocol uses differential compression to prevent double-paying the
                same rate:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  If an ancestor&#39;s level is <strong>higher</strong> than the claimer&#39;s level,
                  they receive the <em>differential</em>: <code>(levelRates[B] − levelRates[A]) % × gross</code>.
                </li>
                <li>
                  If a <strong>direct parent</strong> has a level equal to or below the claimer,
                  they receive a flat <strong>10 %</strong> same-level bonus.
                </li>
                <li>
                  Indirect ancestors at the same or lower level receive nothing.
                </li>
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">
                All bonuses are paid fee-free via <code>VVVPayout.payPrincipal</code> immediately
                upon the downstream claim. If Payout ETH is insufficient, payments enter a queue
                that is flushed once liquidity is restored.
              </p>
            </SubSection>
            <SubSection title="5.3 Level System">
              <p>
                User levels are determined by cumulative personal staking volume and are
                configurable by the contract owner via <code>setLevelThreshold</code> and{' '}
                <code>setLevelRate</code>. This allows the protocol team to tune incentives without
                redeploying contracts.
              </p>
            </SubSection>
          </Section>

          {/* Security */}
          <Section id="security" title="6. Security">
            <SubSection title="6.1 Contract-Level Safeguards">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>ReentrancyGuard</strong> (OpenZeppelin) on all state-modifying external
                  functions.
                </li>
                <li>
                  <strong>Pausable</strong> — owner can halt all operations in an emergency.
                </li>
                <li>
                  <strong>Ownable</strong> with <code>transferOwnership</code> — admin key rotation
                  without redeployment.
                </li>
                <li>
                  <strong>Non-custodial</strong> — staking contract never holds user funds; all
                  token custody is isolated in Treasury and Payout.
                </li>
              </ul>
            </SubSection>
            <SubSection title="6.2 Admin Backend">
              <ul className="list-disc pl-5 space-y-1">
                <li>HMAC-SHA-256 signed session cookies with a 30-minute idle timeout.</li>
                <li>All admin actions logged to an immutable audit-log table.</li>
                <li>Separate wallet validation (Base Sepolia) enforced in the admin UI.</li>
              </ul>
            </SubSection>
            <SubSection title="6.3 Planned Audit">
              <p>
                An independent third-party security audit of the four core contracts is scheduled
                prior to mainnet deployment.
              </p>
            </SubSection>
          </Section>

          {/* Roadmap */}
          <Section id="roadmap" title="7. Roadmap">
            <div className="space-y-4">
              {[
                { phase: 'Phase 1 — Testnet', status: 'Completed', items: ['Contract deployment on Base Sepolia', 'Full staking / claim / withdraw flow', 'Admin panel (6 modules)', 'Dual-mode staking UI'] },
                { phase: 'Phase 2 — Mainnet Launch', status: 'In Progress', items: ['Third-party contract audit', 'Base mainnet deployment', 'Real liquidity pool seeding', 'Public beta launch'] },
                { phase: 'Phase 3 — Growth', status: 'Planned', items: ['The Graph event indexer', 'Server-side team reward calculation', 'Notification read-state sync across devices', 'Multi-language expansion'] },
                { phase: 'Phase 4 — Ecosystem', status: 'Planned', items: ['Governance module', 'Cross-chain bridge support', 'SDK for third-party integrations', 'Community DAO'] },
              ].map(({ phase, status, items }) => (
                <div key={phase} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{phase}</h4>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                      status === 'Completed'
                        ? 'bg-green-500/15 text-green-400'
                        : status === 'In Progress'
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {status}
                    </span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    {items.map(i => <li key={i}>{i}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* Contract Addresses */}
          <Section id="contracts" title="8. Contract Addresses">
            <p className="text-sm text-muted-foreground">
              The following addresses are the canonical deployments on Base Sepolia testnet.
              Mainnet addresses will be published upon audit completion.
            </p>
            <Table
              headers={['Contract', 'Base Sepolia Address']}
              rows={[
                ['VVVToken', '0x3C03096D6174b7d6Cc6d5f1e442f43B269Bc3A30'],
                ['VVVEcoStaking', '0x707AeF5E4331c45F1b11aA50EB452b396cE69DD9'],
                ['VVVPayout', '0x6cb514724C355Be8A2d19D1228DF8300cBb1CbA6'],
                ['VVVTreasury', '0xD9247b65A641c67b4Db600494af67E0De6e17e72'],
                ['MockRouter', '0x9BB5BA22C26B816157Cd943b13bEe8967aAe01B1'],
              ]}
            />
          </Section>

          {/* Footer */}
          <div className="border-t border-border pt-8 text-sm text-muted-foreground space-y-2">
            <p>
              This document is provided for informational purposes only and does not constitute
              financial or investment advice. Smart-contract code is open source and available on
              GitHub.
            </p>
            <p>© 2026 VVVEco Protocol. All rights reserved.</p>
          </div>
        </article>
      </div>
    </div>
  )
}

// ── Shared layout primitives ─────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-bold tracking-tight border-b border-border pb-2">{title}</h2>
      <div className="space-y-4 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary">
          <tr>
            {headers.map(h => (
              <th key={h} className="px-4 py-2 text-left font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-secondary/40 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2 ${j === 0 ? 'font-medium text-foreground' : ''}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-secondary p-4 text-xs leading-relaxed text-foreground font-mono">
      {children}
    </pre>
  )
}
