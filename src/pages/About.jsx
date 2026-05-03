import React from 'react';
import { Link } from 'react-router-dom';
import { Plane, Users, Code, Target } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <header className="mb-10">
          <Link to="/" className="text-cyan-400 hover:text-cyan-300 text-sm font-mono uppercase tracking-wider">
            ← Home
          </Link>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white">About SkyCareer</h1>
          <p className="mt-3 text-lg text-slate-400">
            Your virtual airline career platform for flight simulation enthusiasts.
          </p>
        </header>

        <section className="prose prose-invert max-w-none space-y-5 text-slate-300 leading-relaxed">
          <p>
            <strong className="text-white">SkyCareer</strong> is a comprehensive virtual airline management
            platform designed to enrich your flight simulation experience with X-Plane 12 and Microsoft
            Flight Simulator. We turn every flight into a meaningful career step by tracking your
            performance, fleet, finances, and reputation in real time through a dedicated simulator
            plugin that streams live telemetry to your account.
          </p>

          <p>
            With SkyCareer you can found your own airline, accept passenger, cargo, charter and emergency
            contracts, hire and train crew, purchase and maintain aircraft, manage hangars at airports
            around the world, earn type-ratings, climb a global leaderboard, and unlock achievements as
            you progress. Every landing is automatically scored based on touchdown rate, G-forces, and
            adherence to flight discipline, and every contract pays out based on the quality of your
            execution. Smart maintenance, insurance options, loans and an in-game economy give your
            decisions long-term consequences.
          </p>

          <p>
            <strong className="text-white">Who it's for:</strong> SkyCareer is built for hobbyist pilots,
            home cockpit builders, virtual aviation communities, and anyone who wants more depth and
            persistence in their flight sim sessions. Whether you fly a Cessna 172 around your local
            airfield or operate long-haul widebody routes, SkyCareer gives your flights purpose,
            progression and a sense of achievement.
          </p>

          <p>
            <strong className="text-white">Who builds it:</strong> SkyCareer is developed by an
            independent team of flight simulation enthusiasts who care deeply about realism, fair
            scoring, and a polished user experience. We ship updates frequently, listen to community
            feedback, and continuously expand the platform with new aircraft, features, and integrations.
          </p>
        </section>

        <section className="mt-12 grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <Plane className="w-6 h-6 text-cyan-400 mb-2" />
            <h2 className="text-lg font-bold text-white mb-1">Realistic Career</h2>
            <p className="text-sm text-slate-400">Live telemetry, automatic scoring, and persistent progression.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <Target className="w-6 h-6 text-cyan-400 mb-2" />
            <h2 className="text-lg font-bold text-white mb-1">Global Contracts</h2>
            <p className="text-sm text-slate-400">Passenger, cargo, charter and emergency missions worldwide.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <Users className="w-6 h-6 text-cyan-400 mb-2" />
            <h2 className="text-lg font-bold text-white mb-1">Community-Driven</h2>
            <p className="text-sm text-slate-400">Built with continuous feedback from real simmers.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <Code className="w-6 h-6 text-cyan-400 mb-2" />
            <h2 className="text-lg font-bold text-white mb-1">Sim Integration</h2>
            <p className="text-sm text-slate-400">Plugins for X-Plane 12 and Microsoft Flight Simulator.</p>
          </div>
        </section>

        <footer className="mt-16 pt-6 border-t border-slate-800 flex gap-6 text-sm text-slate-500">
          <Link to="/About" className="hover:text-cyan-400">About</Link>
          <Link to="/Contact" className="hover:text-cyan-400">Contact</Link>
          <Link to="/" className="hover:text-cyan-400">Home</Link>
        </footer>
      </div>
    </div>
  );
}