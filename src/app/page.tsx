import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-4">School Photos</h1>
      <p className="text-muted-foreground mb-8">
        School photo management system
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90"
        >
          Log In
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-input px-6 py-3 font-medium hover:bg-accent"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
