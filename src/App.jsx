function App() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(242,127,90,0.16),_transparent_28%),linear-gradient(180deg,_#fff8ef_0%,_#f5efe6_100%)] px-5 py-6 text-slate-800 sm:px-8 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl content-center gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-white/80 px-6 py-10 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur md:px-10 md:py-14">
          <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(242,127,90,0.18),_transparent_68%)]" />
          <p className="relative mb-4 text-xs uppercase tracking-[0.24em] text-amber-800">
            Innovation starts here
          </p>
          <h1 className="relative font-serif text-6xl leading-none tracking-tight text-slate-900 sm:text-7xl lg:text-[6.5rem]">
            Innovationery
          </h1>
          <p className="relative mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            A clean starting point for building products, experiments, and ideas
            that deserve a real launch.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#about"
              className="inline-flex min-h-12 items-center rounded-full bg-gradient-to-br from-slate-900 to-sky-700 px-5 text-sm font-medium text-orange-50 transition hover:brightness-110"
            >
              Explore the vision
            </a>
            <span className="inline-flex min-h-12 items-center rounded-full bg-sky-900/10 px-5 text-sm font-medium text-sky-900">
              Vite + React + Firebase ready
            </span>
          </div>
        </section>

        <section
          id="about"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          <article className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-7 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur">
            <div className="absolute -bottom-14 -right-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(242,127,90,0.18),_transparent_68%)]" />
            <h2 className="relative text-xl font-semibold text-slate-900">
              Fast foundation
            </h2>
            <p className="relative mt-3 leading-7 text-slate-600">
              Built on Vite and React so the app is ready for quick iteration
              from day one.
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-7 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur">
            <div className="absolute -bottom-14 -right-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(242,127,90,0.18),_transparent_68%)]" />
            <h2 className="relative text-xl font-semibold text-slate-900">
              Firebase enabled
            </h2>
            <p className="relative mt-3 leading-7 text-slate-600">
              Firebase is installed and the project includes an environment-based
              app bootstrap for when you wire in credentials.
            </p>
          </article>

          <article className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-white/80 p-7 shadow-[0_24px_80px_rgba(10,34,51,0.08)] backdrop-blur md:col-span-2 xl:col-span-1">
            <div className="absolute -bottom-14 -right-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,_rgba(242,127,90,0.18),_transparent_68%)]" />
            <h2 className="relative text-xl font-semibold text-slate-900">
              Room to grow
            </h2>
            <p className="relative mt-3 leading-7 text-slate-600">
              This homepage is intentionally minimal so you can layer in auth,
              data, and product flows without reworking the foundation.
            </p>
          </article>
        </section>
      </div>
    </main>
  )
}

export default App
