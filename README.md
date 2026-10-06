# Dhan Intraday Desk

Local Dhan dashboard for live market data, a 15-minute EMA 21/34 + Supertrend + VWAP scanner, Paper positions, and confirmed Live order previews.

## Run

```sh
npm install
npm start
```

Open <http://localhost:3000>. The server binds to loopback only.

## Connect Dhan

Enter your Dhan Client ID and current access token in the account panel. The server verifies the token against Dhan's profile endpoint and keeps credentials in memory only. Restarting the server or disconnecting clears them.

Live market data requires an active Dhan Data API plan. Order placement requires Dhan's static-IP allowlisting. Paper mode uses Dhan market data while simulating entries and exits. Live mode previews each order and requires a separate confirmation before sending it to Dhan.

The dashboard does not submit unattended Live orders. Treat option selling as high risk; validate contract, quantity, margin, and order details before confirmation.
