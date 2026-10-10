# APAX Technical Assessment

## Test the login flow locally

The login API uses MongoDB to find the user and verify the password. The
frontend and API are started together from the `web` folder.

1. Configure the backend environment. Copy
   `web/src/config/config.env.example` to `web/.env`, then set:
   - `MONGO_URI` to your MongoDB connection string.
   - `JWT_SECRET` to a private random value at least 32 characters long.
   - `PORT=4000` (or leave it set to 4000).

   The backend reads `web/.env`. Do not commit this file or share its
   credentials.
2. Make sure MongoDB contains a user with the email and password you plan to
   test. The password must have been saved through the `User` model so it is
   bcrypt-hashed; do not insert a plaintext password directly into MongoDB.
   The minimal server startup does not enable the registration endpoint, so
   use an existing test account or create one through a trusted backend
   seeding/setup process.
3. In a terminal, start the app:

   ```bash
   cd web
   npm install
   npm run dev
   ```

   Wait for the backend logs to show that it is listening on port `4000` and
   that MongoDB connected. If MongoDB does not connect, login requests return
   `503` until the connection is ready.
4. Open `http://localhost:3000/login`, enter the test account's email and
   password, and submit. A successful login should take you into the dashboard.
   The API responds at `POST http://localhost:4000/user/login` with the user
   details and sets the JWT as an HTTP-only `token` cookie. The token is
   intentionally not stored in `localStorage`.
5. Try an incorrect password to verify that the form displays an error and
   does not navigate to the dashboard. A successful login should show the
   `token` cookie in browser DevTools under Application/Storage → Cookies for
   `localhost`; because it is HTTP-only, page JavaScript cannot read it.

---

## Frontend Task B: Dashboard data thinking

### Recommended wiring plan

I would start at the existing mock boundary in `store.ts`: that is where the dashboard currently gets `userHoldings`, `metalPrices`, and audit/activity data. The UI components that read from it, especially `portfolio-overview.tsx` and `dashboard-view.tsx`, can stay mostly intact.

#### 1) Change the store first, not the whole screen

Add an async dashboard slice, not a full refactor:

- `fetchDashboardData()`
- `status: 'idle' | 'loading' | 'ready' | 'error'`
- `error?: string`
- `holdings` and `activity` state

Example shape:

```ts
type HoldingsApi = {
  gold: { asset: 'gold'; amount: number; updatedAt: string | null }
  silver: { asset: 'silver'; amount: number; updatedAt: string | null }
  platinum: { asset: 'platinum'; amount: number; updatedAt: string | null }
}

type ActivityItem = {
  id: string
  type: 'deposit' | 'redeem' | 'mint' | 'audit'
  amount: number
  asset: 'gold' | 'silver' | 'platinum'
  createdAt: string
}
```

Then in the store:

```ts
fetchDashboardData: async () => {
  set({ status: 'loading', error: undefined })
  try {
    const [holdingsRes, activityRes] = await Promise.all([
      baseAPI('/api/holdings', 'GET'),
      baseAPI('/api/activity', 'GET'),
    ])

    if (!holdingsRes.success || !activityRes.success) {
      throw new Error(holdingsRes.message || activityRes.message)
    }

    set({
      holdings: holdingsRes.data.holdings,
      activity: activityRes.data.items ?? [],
      status: 'ready',
    })
  } catch (err) {
    set({
      status: 'error',
      error: err instanceof Error ? err.message : 'Unable to load dashboard data',
    })
  }
}
```

This preserves the current view structure while swapping the source of truth from mock state to the API.

#### Where I'd mount the fetch

I would fetch once at the dashboard boundary, likely in `dashboard-view.tsx`, with a small `useEffect`:

```ts
useEffect(() => {
  void useAPAXStore.getState().fetchDashboardData()
}, [])
```

That keeps the UI changes minimal. The child components still read the store values they already expect; only the data source changes.

### Loading, empty, and error handling

**Loading**

Use a small state-aware render in the view:

```tsx
if (status === 'loading') return <DashboardSkeleton />
```

This can be a lightweight skeleton card or just a "Loading your portfolio..." text. No need to block the entire page if only one section is data-dependent.

**Empty**

If holdings are all zero or the activity array is empty:

```ts
const hasHoldings = Object.values(holdings).some((h) => h.amount > 0)
```

Then render a friendly empty state:

- "No holdings yet"
- "No recent activity"

This is better than crashing or showing misleading zeros.

**Error**

If the request fails, keep the rest of the dashboard stable:

```tsx
if (status === 'error') {
  return <DashboardErrorState message={error} retry={fetchDashboardData} />
}
```

This is especially important because the app already has a common API pattern in `base.api.ts`, where the service returns `success` and `message`.

### Keep TypeScript honest

The key is to stop mixing "mock UI types" and "server response types." I would define a single source of truth:

- `DashboardHolding`
- `DashboardActivityItem`
- `DashboardState`

Then map the server payload into those exact types at the API boundary.

Example:

```ts
type ApiHolding = {
  asset: 'gold' | 'silver' | 'platinum'
  amount: number
  updatedAt: string | null
}

type DashboardHolding = {
  asset: 'gold' | 'silver' | 'platinum'
  amount: number
  updatedAt: Date | null
}
```

Then normalize once:

```ts
const normalizeHoldings = (dto: ApiHolding[]): DashboardHoldingMap => ({
  gold: { asset: 'gold', amount: dto.find(...)?..., updatedAt: ... },
  silver: ...
})
```

This keeps the UI strongly typed while still allowing API differences. The app-level types should reflect what the UI expects, not the raw JSON shape from Mongo.

### Why this is the low-risk path

- It touches the data boundary only, not the whole dashboard.
- The presentational components in `portfolio-overview.tsx` can keep the same rendering logic.
- The store becomes the adapter layer between API payloads and UI state.
- It preserves the existing Zustand architecture without a full rewrite.

This is the cleanest way to move off mocks while keeping the UI stable and typed.

---

## Blockchain Task A: Compliance-aware metal token (APX-Gold)

**Design.** One token contract per metal, built on OpenZeppelin's ERC-20 with AccessControl and Pausable. A custom transfer hook checks compliance on every transfer. One token represents a fixed quantity of metal (for example 1 gram), backed 1:1 by allocated custody.

**Roles (kept separate)**

- **Admin:** a multisig with a timelock. It manages roles and configuration only, and it cannot mint.
- **Minter:** used by the custody-operations service, and only after a verified deposit.
- **Redeemer/burner:** the redemption contract, or a dedicated role.
- **Compliance:** updates the whitelist and freezes addresses.
- **Pauser:** emergency stop.

**Mint tied to deposit.** Each mint carries a unique deposit reference that can be used only once, which prevents double minting. Total supply cannot exceed the latest attested reserves, so a stolen or buggy minter key has limited reach. Tokens can only be minted to verified addresses.

**Transfer restrictions.** Every transfer between users requires that the sender and receiver are verified and not frozen, and that the contract is not paused. The check goes through a small compliance interface, so the whitelist can be swapped for a full identity registry later without changing the token.

**Burn tied to redemption.** Only the redeemer role can burn, and only after a redemption request has been confirmed. Each burn emits an event carrying the redemption ID.

**ERC-20 + custom gates vs ERC-3643 (tradeoffs)**

- **ERC-20 + custom gates:** smaller, faster to build, and easier to test and audit. That fits the current stage, since the contracts are not written yet. The downside is that the compliance logic is bespoke and less recognisable to institutions.
- **ERC-3643:** a proper standard, with an identity registry, claims, compliance modules, and recovery. The downside is more contracts, more audit surface, and an identity provider to integrate. I have not built with it directly, so I would study the spec and reference implementation before committing.
- **Recommendation:** a hybrid. Start with ERC-20 plus a compliance interface shaped like ERC-3643's, then move to the full standard if partners require it.

**Test plan (Hardhat or Foundry)**

- Mint succeeds for the minter to a verified address, and fails for non-minters, unverified recipients, a reused deposit reference, or amounts above attested reserves.
- Transfers succeed between verified users and are blocked to or from unverified or frozen addresses, including through `transferFrom`.
- Pause blocks all transfers, and unpause restores them.
- Burn reduces supply and emits the event, and only the redeemer can call it.
- Invariants (fuzz): supply never exceeds reserves, and tokens never reach an unverified address.

**Biggest risks**

1. **Key or role compromise**, especially the minter key, which means unbacked tokens. Mitigation: multisig, timelock, and mint caps.
2. **Reserve mismatch or oracle manipulation.** Mitigation: redundant attestations.
3. **Whitelist bypasses** through approvals, permits, contract wallets, or mint and burn special cases.
4. **Admin centralisation**, since freeze and pause powers need clear governance.
5. **Upgrade risks** if proxies are used (storage collisions, uninitialised proxies).
6. **Reentrancy** in redemption hooks.
7. **Deployment key handling.**
8. An independent audit is needed before mainnet.

---

## Blockchain Task B: Frontend and backend integration

**Reading balance and allowance in Next.js.** Use wagmi: `useAccount` for the wallet and `useReadContract` for `balanceOf` and `allowance`, with the typed ABI. Check the chain ID, format by the token's decimals, and refetch after a transaction is confirmed.

**Chain vs MongoDB as the source of truth**

- **The chain is the source of truth** for ownership and supply. MongoDB is a read model for a fast dashboard, plus off-chain data such as KYC status and redemption requests.
- **An indexer** listens for transfer, mint, burn, and redemption events and waits for confirmations. It stores each event with a unique `txHash + logIndex`, so duplicates are ignored and replays are safe, and it tracks the last processed block so it can restart and backfill.
- **Reorgs:** store block hashes so it can roll back.
- **Reconciliation:** a periodic job compares on-chain balances with MongoDB. If they differ, the chain wins, and the mismatch is flagged.
- **KYC:** the approval status lives off-chain, and the compliance role writes it on-chain. The on-chain flag is what enforces.

**Redemption before burn**

1. The user submits a request, and the backend checks authentication, valid KYC, and that the amount is within their balance, and rejects duplicates.
2. A compliance check runs.
3. The tokens are **locked in escrow**, not burned yet, so they cannot be spent while the request is open.
4. Custody confirms the physical delivery or settlement.
5. The authorised redeemer **burns** the escrowed tokens, and the event updates the request to completed.
6. If the request is rejected or cancelled, the tokens return to the user.

Burning only after custody confirms avoids destroying a user's tokens when the metal is never delivered.
