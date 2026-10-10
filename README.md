# Demo APAX App

A minimal Web3 demo showcasing a portfolio vault with a modern frontend, backend API, and smart contracts.

## 🧱 Stack

- **Frontend**: Next.js
- **Backend**: Node.js + Express + ethers
- **Smart Contracts**: Solidity (Hardhat)

## 🔁 Architecture Flow

Frontend → Backend → Blockchain

- The frontend never talks directly to the blockchain
- The backend provides clean APIs and reads on-chain data
- The smart contract is the source of truth

---

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

## Assessment response: Task 2 — Dashboard data thinking

The dashboard currently reads portfolio and activity values from mock Zustand
state in `web/lib/store.ts`. I would move it to live data incrementally, keeping
the existing UI intact and changing the data boundary first.

### What I would change first

1. Add typed frontend service functions for holdings and recent activity.
   `GET /api/holdings` is implemented and returns `data.userId` plus a `holdings`
   object keyed by gold, silver, and platinum. The existing `baseAPI` helper
   currently prefixes requests with `/user`, so I would extend or complement
   that helper to support `/api` routes while retaining
   `credentials: 'include'` for the HTTP-only cookie authentication. I would
   not introduce localStorage token handling.
2. Add asynchronous dashboard state and a `fetchDashboardData` action to the
   Zustand store. The store would adapt API data to the types already consumed
   by dashboard components, such as `PortfolioOverview`, rather than requiring
   a broad UI rewrite.
3. Trigger the fetch at the dashboard boundary, such as in `DashboardView`,
   and keep presentation components responsible for rendering the store state.
   Handle repeated effects or stale requests so an older response cannot
   overwrite newer data.

### Loading, empty, and error states

- **Loading:** Show a lightweight loading state for the data-dependent
  dashboard section instead of presenting initial mock values as live data.
- **Empty:** Treat a valid response with zero holdings or no activity as an
  empty state, with messages such as “No holdings yet” and “No recent
  activity.”
- **Error:** Display a clear message and retry action. Track loading and errors
  per resource so a failure to load activity does not hide holdings that
  loaded successfully (or vice versa).

### Keeping TypeScript types honest

Define API DTO types separately from UI/store types, for example
`ApiHolding`, `DashboardHolding`, and `DashboardActivityItem`. Validate and
normalize data once at the service boundary, including converting timestamp
strings to `Date` values where the UI needs them. Confirm and document the unit
of the API's `amount` before mapping it to the UI's gram-based fields. Avoid
assuming an unvalidated API response already matches the store type.

### API dependencies and mock data

The current `GET /api/holdings` endpoint is authenticated and returns the
three-metal portfolio structure, so it can be the first live dashboard source.
The current `/activity` route is not yet an appropriate recent-activity API:
it returns in-memory summary data and is not user-scoped/authenticated. Before
connecting activity, add a protected endpoint with a stable, user-scoped
response contract.

Holdings data alone does not provide live metal prices, vault metrics, or
APX-i token balances. Keep those clearly marked as mock data until their
respective APIs exist, and remove or gate the simulated price and activity
updates as each live source is connected.

This staged approach preserves the existing Zustand architecture and
presentational components while moving each dashboard resource off mocks
independently.

---

## 📁 Project Structure

```text
/apax
├── /smart-contracts          # Hardhat and Smart Contracts
│   ├── /contracts
│   ├── /scripts
│   ├── /test
│   ├── hardhat.config.ts
│   ├── package.json
│   └── .env
│
├── /web                 # Web frontend (Next.js)
│   ├── /app
│   ├── /components
│   ├── /hooks
│   ├── /lib
│   ├── /public
│   ├── /src
│   ├── package.json
│   └── tsconfig.json
│
├── /shared                   # Shared resources (like ABIs)
│   ├── /abi
│   └── constants.ts
│
└── README.md                 # Project documentation

```

## Install Dependencies

From the **root of the repository**:

```bash
cd /web
npm install
```

## Run the Project

From the **root of the repository**:

```bash
npm run dev
```

## Once running, open your browser and go to: http://localhost:3000 to view the app locally.