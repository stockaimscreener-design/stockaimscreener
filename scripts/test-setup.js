#!/usr/bin/env node

/**
 * Test script to verify StockAimScreener setup
 * Run with: node scripts/test-setup.js
 */

const fs = require('fs')
const path = require('path')

console.log('🧪 Testing StockAimScreener Setup...\n')

// Check if required files exist
const requiredFiles = [
  'package.json',
  'next.config.js',
  'tailwind.config.js',
  'tsconfig.json',
  'app/layout.tsx',
  'app/page.tsx',
  'app/screener/page.tsx',
  'app/contact/page.tsx',
  'lib/supabase.ts',
  'components/Navigation.tsx',
  'supabase/screener/index.ts',
  'supabase/update-stocks/index.ts'
]

let allFilesExist = true

console.log('📁 Checking required files:')
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file)
  console.log(`  ${exists ? '✅' : '❌'} ${file}`)
  if (!exists) allFilesExist = false
})

// Check package.json dependencies
console.log('\n📦 Checking dependencies:')
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const requiredDeps = ['next', 'react', 'typescript', 'tailwindcss', 'framer-motion', '@supabase/supabase-js']
  
  requiredDeps.forEach(dep => {
    const exists = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]
    console.log(`  ${exists ? '✅' : '❌'} ${dep}`)
    if (!exists) allFilesExist = false
  })
} catch (error) {
  console.log('  ❌ Could not read package.json')
  allFilesExist = false
}

// Check environment file
console.log('\n🔐 Checking environment setup:')
const envExampleExists = fs.existsSync('env.example')
console.log(`  ${envExampleExists ? '✅' : '❌'} env.example exists`)

const envLocalExists = fs.existsSync('.env.local')
console.log(`  ${envLocalExists ? '✅' : '⚠️'} .env.local exists (you may need to configure it)`)

// Summary
console.log('\n📊 Setup Summary:')
if (allFilesExist) {
  console.log('✅ All required files are present!')
  console.log('\n🚀 Next steps:')
  console.log('  1. Copy env.example to .env.local and add your API keys')
  console.log('  2. Run: npm install')
  console.log('  3. Set up your Supabase database')
  console.log('  4. Run: npm run dev')
  console.log('  5. Visit http://localhost:3000')
} else {
  console.log('❌ Some files are missing. Please check the setup.')
}

console.log('\n📚 For detailed setup instructions, see README.md')

