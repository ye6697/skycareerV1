import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  Plane,
  DollarSign,
  Users,
  TrendingUp,
  MapPin,
  Calendar,
  Award,
  Activity,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function Landing() {
  const features = [
    {
      icon: Plane,
      title: 'Build Your Fleet',
      description: 'Purchase and manage aircraft from small props to wide-body jets as you grow your airline empire.'
    },
    {
      icon: DollarSign,
      title: 'Financial Management',
      description: 'Track revenue, manage expenses, and make strategic decisions to keep your airline profitable.'
    },
    {
      icon: Users,
      title: 'Hire Crew',
      description: 'Recruit pilots, first officers, and flight attendants with varying skills and experience levels.'
    },
    {
      icon: MapPin,
      title: 'Global Contracts',
      description: 'Accept passenger, cargo, and charter contracts from airports around the world.'
    },
    {
      icon: TrendingUp,
      title: 'Level Up',
      description: 'Gain experience, unlock new aircraft, and progress from hobby pilot to aviation tycoon.'
    },
    {
      icon: Activity,
      title: 'X-Plane Integration',
      description: 'Connect with X-Plane 12 to track real-time flight data and calculate performance metrics.'
    }
  ];

  const stats = [
    { value: '50+', label: 'Aircraft Types' },
    { value: '1000+', label: 'Global Routes' },
    { value: '100', label: 'Career Levels' },
    { value: 'Real-time', label: 'Flight Tracking' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1920')] bg-cover bg-center opacity-10" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30">
                <Plane className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold text-white">
                SkyCareer
              </h1>
            </div>
            
            <p className="text-xl lg:text-2xl text-slate-300 mb-4 max-w-3xl mx-auto">
              Build Your Aviation Empire in X-Plane 12
            </p>
            
            <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
              A comprehensive career mode that transforms X-Plane 12 into a complete airline management simulation. Track flights, manage finances, hire crew, and grow from a single aircraft to a global airline.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={createPageUrl('Dashboard')}>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
                  Get Started <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to={createPageUrl('XPlaneSetup')}>
                <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 text-lg px-8 py-6">
                  Setup X-Plane
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-20"
          >
            {stats.map((stat, index) => (
              <Card key={index} className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 text-center">
                <div className="text-3xl lg:text-4xl font-bold text-blue-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-slate-400">
                  {stat.label}
                </div>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-xl text-slate-400">
              Complete airline management at your fingertips
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6 h-full hover:bg-slate-800 transition-all duration-300 hover:border-blue-500/50">
                  <feature.icon className="w-12 h-12 text-blue-400 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-slate-400">
              Get started in minutes
            </p>
          </motion.div>

          <div className="space-y-8">
            {[
              {
                step: '1',
                title: 'Install the Plugin',
                description: 'Download and install the X-Plane 12 plugin to enable real-time flight tracking.'
              },
              {
                step: '2',
                title: 'Create Your Airline',
                description: 'Set up your company, purchase your first aircraft, and hire your initial crew.'
              },
              {
                step: '3',
                title: 'Accept Contracts',
                description: 'Browse available passenger, cargo, and charter contracts from around the world.'
              },
              {
                step: '4',
                title: 'Fly & Earn',
                description: 'Complete flights in X-Plane 12 while the app tracks your performance and calculates earnings.'
              },
              {
                step: '5',
                title: 'Grow Your Empire',
                description: 'Reinvest profits to expand your fleet, hire more crew, and unlock new opportunities.'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700 p-6">
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-white">{item.step}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Award className="w-16 h-16 text-amber-400 mx-auto mb-6" />
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
              Ready to Take Off?
            </h2>
            <p className="text-xl text-slate-400 mb-8">
              Start your aviation career today and build the airline of your dreams
            </p>
            <Link to={createPageUrl('Dashboard')}>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-12 py-6">
                Launch SkyCareer <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center text-slate-500">
          <p>© 2026 SkyCareer - X-Plane 12 Career Mode</p>
        </div>
      </footer>
    </div>
  );
}