import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Globe } from 'lucide-react';

export default function Contact() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <header className="mb-10">
          <Link to="/" className="text-cyan-400 hover:text-cyan-300 text-sm font-mono uppercase tracking-wider">
            ← Home
          </Link>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white">Contact Us</h1>
          <p className="mt-3 text-lg text-slate-400">
            Questions, feedback, or partnership ideas? We'd love to hear from you.
          </p>
        </header>

        <section className="space-y-4">
          <a
            href="mailto:support@skycareer.app"
            className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-cyan-500/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Mail className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Email Support</h2>
              <p className="text-sm text-slate-400">support@skycareer.app</p>
            </div>
          </a>

          <a
            href="https://discord.gg/skycareer"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-cyan-500/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Community Discord</h2>
              <p className="text-sm text-slate-400">Join other pilots, share feedback, get fast help.</p>
            </div>
          </a>

          <a
            href="https://skycareer.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-cyan-500/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Globe className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Website</h2>
              <p className="text-sm text-slate-400">skycareer.app</p>
            </div>
          </a>
        </section>

        <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900/30 p-5">
          <h2 className="text-lg font-bold text-white mb-2">Response time</h2>
          <p className="text-sm text-slate-400">
            We usually respond to emails within 1–2 business days. For urgent issues (lost
            subscriptions, account access), please mention your registered email address.
          </p>
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