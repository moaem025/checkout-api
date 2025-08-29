// pages/index.tsx
export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Checkout API Host</h1>
      <p>POST to <code>/api/create-checkout-session</code> to create a Stripe Checkout session.</p>
    </main>
  );
}
