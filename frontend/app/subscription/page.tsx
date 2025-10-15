'use client'

import { motion } from 'framer-motion'

export default function SubscriptionPage() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'month',
      features: [
        'Basic stock search',
        'Top 50 stocks view',
        'Limited screening (10 results)',
        'Basic market data'
      ],
      limitations: [
        'Limited to 10 screening results',
        'No advanced filters',
        'No email alerts'
      ],
      cta: 'Current Plan',
      ctaStyle: 'btn-secondary',
      popular: false
    },
    {
      name: 'Pro',
      price: '$9',
      period: 'month',
      features: [
        'Unlimited stock screening',
        'Advanced filters & comparisons',
        'Real-time data updates',
        'Email alerts',
        'Export to CSV',
        'Priority support'
      ],
      limitations: [],
      cta: 'Upgrade to Pro',
      ctaStyle: 'btn-primary',
      popular: true
    },
    {
      name: 'Premium',
      price: '$29',
      period: 'month',
      features: [
        'Everything in Pro',
        'API access',
        'Custom alerts',
        'Advanced analytics',
        'White-label options',
        'Dedicated support',
        'Custom integrations'
      ],
      limitations: [],
      cta: 'Go Premium',
      ctaStyle: 'btn-primary',
      popular: false
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Choose Your Plan
            </h1>
            <p className="text-lg text-gray-600">
              Unlock advanced features and get the most out of StockAim Screener
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative card ${
                plan.popular ? 'ring-2 ring-primary-500 bg-primary-50' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-primary-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price}
                  </span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
                {plan.limitations.map((limitation, limitationIndex) => (
                  <li key={limitationIndex} className="flex items-start">
                    <svg
                      className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <span className="text-gray-500">{limitation}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full ${plan.ctaStyle} ${
                  plan.name === 'Free' ? 'cursor-not-allowed opacity-75' : ''
                }`}
                disabled={plan.name === 'Free'}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16"
        >
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I change plans anytime?
              </h3>
              <p className="text-gray-600">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Yes, all paid plans come with a 14-day free trial. No credit card required.
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards, PayPal, and bank transfers for enterprise plans.
              </p>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-600">
                Yes, you can cancel your subscription at any time. No cancellation fees.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

