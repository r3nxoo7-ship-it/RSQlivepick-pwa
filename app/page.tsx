'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Zap as Lightning, Target, BarChart3, CheckCircle, Users, Shield, Headphones } from 'lucide-react';
import { useState } from 'react';

const testimonials = [
  {
    name: "Alex Martinez",
    country: "ES",
    rating: 5,
    text: "Incredible tool for live match analysis. The filter system is incredibly flexible and the Telegram alerts are instant.",
    source: "Verified User"
  },
  {
    name: "Chris Thompson",
    country: "UK",
    rating: 5,
    text: "Best investment for any serious football analyst. The speed and accuracy of live scanning is unmatched.",
    source: "Verified User"
  },
  {
    name: "Marco Rossi",
    country: "IT",
    rating: 5,
    text: "Finalmente uno strumento che capisce veramente il calcio. Perfetto per le strategie in-play.",
    source: "Verified User"
  },
  {
    name: "Stefan Petrov",
    country: "BG",
    rating: 5,
    text: "The customizable filters make this stand out. Great support team, very responsive.",
    source: "Verified User"
  },
  {
    name: "João Silva",
    country: "PT",
    rating: 5,
    text: "Excellent for tracking matches in real-time. The statistics are always accurate and up-to-date.",
    source: "Verified User"
  },
  {
    name: "Anna Klein",
    country: "DE",
    rating: 5,
    text: "Schönes Design, sehr schnell und zuverlässig. Genau das, was ich gesucht habe.",
    source: "Verified User"
  }
];

const faqs = [
  {
    q: "What is R$Q LIVE?",
    a: "R$Q LIVE is a private, real-time football match scanner that lets you create powerful custom filters (100+ conditions) and receive instant notifications via Telegram and web push when matches meet your criteria."
  },
  {
    q: "How does the scanner work?",
    a: "The system continuously monitors live football matches across 1000+ leagues, applies your custom filters in real-time, and sends notifications the moment conditions match. No manual checking needed."
  },
  {
    q: "What conditions can I filter by?",
    a: "You can combine 100+ conditions including corners, shots, cards, goals, possession, time ranges, odds, dangerous attacks, momentum, and much more. Fully customizable to your strategy."
  },
  {
    q: "What notification methods are supported?",
    a: "We support both Telegram (instant alerts) and web push notifications (in-browser). Choose what works best for your workflow."
  },
  {
    q: "Is my data private?",
    a: "Yes. All filters and preferences are stored securely with row-level security (RLS). Your data belongs to you alone—we never share or sell personal information."
  },
  {
    q: "Can I combine multiple filters?",
    a: "Absolutely. Create complex strategies by combining filters with AND/OR logic, or use our Super Filter to merge multiple filter conditions into one."
  },
  {
    q: "How many matches are covered?",
    a: "We cover 1000+ worldwide football leagues including all major tournaments, top divisions, and lower leagues across Europe, Americas, Africa, and Asia."
  },
  {
    q: "Is there a free trial?",
    a: "Yes! Start with our full feature set free. Create filters, receive notifications, and explore all tools with no credit card required."
  }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 },
    },
  };

  return (
    <div className="bg-[#0a0a0f] text-white overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full"
          >
            <Lightning className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-300">Live Football Intelligence</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6">
            Turn Live Matches<br />Into <span className="text-cyan-400">Opportunities</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Real-time match scanning meets intelligent filtering. Create powerful, multi-condition filters and get instant notifications. For serious analysts who demand precision.
          </p>

          {/* CTA Buttons - Professional Layout */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-12">
            <Link
              href="/register"
              className="group relative px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl transition-all duration-300 flex items-center gap-2 backdrop-blur"
            >
              Sign In
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Stats Row */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              { label: "Active Filters", value: "5,000+" },
              { label: "Leagues Covered", value: "1,000+" },
              { label: "Live Matches", value: "24/7" },
              { label: "Alert Speed", value: "<100ms" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4"
              >
                <div className="text-sm text-gray-400">{stat.label}</div>
                <div className="text-2xl md:text-3xl font-bold text-cyan-400">{stat.value}</div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-4">Powerful Features Built for Serious Analysis</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Everything you need to turn match data into actionable intelligence</p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {[
            {
              icon: Target,
              title: "100+ Filter Conditions",
              desc: "Combine corners, shots, cards, goals, odds, possession, time ranges, dangerous attacks, momentum, and more."
            },
            {
              icon: Lightning,
              title: "Real-Time Scanning",
              desc: "Instant notifications the moment a match meets your criteria. <100ms alert speed across 1000+ leagues."
            },
            {
              icon: BarChart3,
              title: "Advanced Analytics",
              desc: "Track performance, analyze patterns, export data to Excel/CSV for deeper insights and strategy optimization."
            },
            {
              icon: CheckCircle,
              title: "Smart Filter Management",
              desc: "Create, test, and combine filters. Use templates or build custom strategies. Organize by category."
            },
            {
              icon: Zap,
              title: "Multiple Notification Channels",
              desc: "Choose Telegram for mobile alerts or web push for in-browser notifications. Both instant and reliable."
            },
            {
              icon: Shield,
              title: "Private & Secure",
              desc: "Your filters and data belong to you. Row-level security ensures only you access your strategies."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="bg-gradient-to-br from-white/5 to-white/0 border border-white/10 rounded-2xl p-8 hover:border-cyan-500/30 transition-all"
            >
              <feature.icon className="w-10 h-10 text-cyan-400 mb-4" />
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-400">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section className="relative py-20 px-6 bg-gradient-to-b from-white/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg">Three simple steps to start scanning</p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              {
                num: 1,
                title: "Create Your Filters",
                desc: "Define criteria using 100+ conditions. Set corners, shots, odds, time ranges, cards, or any combination that matches your strategy."
              },
              {
                num: 2,
                title: "Get Instant Alerts",
                desc: "When a live match meets your filter conditions, you receive an instant notification via Telegram or web push. No delays."
              },
              {
                num: 3,
                title: "Analyze & Refine",
                desc: "Track every triggered match, analyze performance, export data to Excel, and optimize your filters over time."
              }
            ].map((step, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="relative"
              >
                <div className="absolute top-0 left-8 w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                  <span className="text-3xl font-black text-cyan-400">{step.num}</span>
                </div>
                <div className="pt-24 bg-white/5 border border-white/10 rounded-2xl p-8">
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-gray-400">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="relative py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black mb-4">Trusted by Serious Analysts</h2>
          <p className="text-gray-400 text-lg">See why users around the world choose R$Q LIVE</p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-sm">
                  {testimonial.country}
                </div>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-xs text-gray-400">{testimonial.source}</div>
                </div>
              </div>
              <div className="flex gap-1 mb-3">
                {Array(testimonial.rating).fill(null).map((_, i) => (
                  <span key={i} className="text-yellow-400">★</span>
                ))}
              </div>
              <p className="text-gray-300 text-sm">{testimonial.text}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-20 px-6 bg-gradient-to-b from-white/5 to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-400 text-lg">Everything you need to know</p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-4"
          >
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-all"
              >
                <button
                  onClick={() => setActiveTab(activeTab === i ? -1 : i)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-all"
                >
                  <span className="font-semibold text-left">{faq.q}</span>
                  <span className={`text-cyan-400 transition-transform ${activeTab === i ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {activeTab === i && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-6 py-4 bg-white/3 border-t border-white/10 text-gray-300"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-6 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-3xl p-12 text-center"
        >
          <h2 className="text-4xl md:text-5xl font-black mb-6">Ready to Get Started?</h2>
          <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">Join thousands of analysts who use R$Q LIVE to turn match data into opportunities. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Link
              href="/register"
              className="group relative px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl transition-all duration-300"
            >
              Sign In
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/10 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-4">
                <Lightning className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">R$Q LIVE</h3>
              <p className="text-gray-400 text-sm">Real-time football intelligence for serious analysts.</p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link href="/dashboard/live" className="hover:text-cyan-400 transition">Live Scanner</Link></li>
                <li><Link href="/dashboard/filters" className="hover:text-cyan-400 transition">Filters</Link></li>
                <li><Link href="/dashboard/notifications" className="hover:text-cyan-400 transition">Notifications</Link></li>
                <li><Link href="/dashboard/analytics" className="hover:text-cyan-400 transition">Analytics</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#faq" className="hover:text-cyan-400 transition">FAQ</a></li>
                <li><a href="mailto:support@rsqlive.com" className="hover:text-cyan-400 transition">Contact</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition">Blog</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition">Changelog</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-cyan-400 transition">About</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition">Terms & Policy</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition">Privacy</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition">Cookies</a></li>
              </ul>
            </div>
          </div>

          {/* Copyright Bar */}
          <div className="border-t border-white/10 pt-8 text-center text-gray-500 text-sm">
            <p className="mb-2">© 2026 R$Q LIVE • Real-time Football Intelligence • Powered by Advanced Match Analysis</p>
            <p>This is not betting advice. Use R$Q LIVE as a data analysis tool only. Always verify information independently.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
