import { Link } from 'react-router-dom';
import { Sparkles, Heart, MessageCircle, Shield } from 'lucide-react';
import { motion } from 'motion/react';

export default function Landing() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-sm font-medium">
            <Sparkles size={16} />
            <span>Exclusive for FUTA Students</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight">
            Connect with your <span className="text-orange-600">Campus Soulmate</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            FUTAConnect is the premier social and matching platform designed specifically for students of the Federal University of Technology Akure. Find friends, study partners, or that special someone.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              to="/auth"
              className="px-8 py-3 bg-orange-600 text-white rounded-full font-bold text-lg hover:bg-orange-700 transition-all shadow-lg shadow-orange-200"
            >
              Get Started
            </Link>
            <Link
              to="/auth"
              className="px-8 py-3 bg-white text-slate-900 border border-slate-200 rounded-full font-bold text-lg hover:bg-slate-50 transition-all"
            >
              Sign In
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="w-full py-12 bg-white rounded-3xl shadow-sm border border-slate-100 px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
              <Heart size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Smart Matching</h3>
            <p className="text-slate-600">Our algorithm connects you with students who share your interests and academic goals.</p>
          </div>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <MessageCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Real-time Chat</h3>
            <p className="text-slate-600">Instantly message your matches and start building meaningful connections on campus.</p>
          </div>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
              <Shield size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Safe & Secure</h3>
            <p className="text-slate-600">Verified student profiles and safety features to ensure a positive campus experience.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
