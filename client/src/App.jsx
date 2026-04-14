import React, { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loans, setLoans] = useState([])
  const [stats, setStats] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    weight: '',
    purity: '22K',
    amount: '',
    interest: '2.0',
    date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [loansRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/loans`),
        axios.get(`${API_BASE}/stats`)
      ])
      setLoans(loansRes.data)
      setStats(statsRes.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_BASE}/loans`, formData)
      setFormData({
        name: '',
        phone: '',
        weight: '',
        purity: '22K',
        amount: '',
        interest: '2.0',
        date: new Date().toISOString().split('T')[0]
      })
      fetchData()
      alert('Loan Created Successfully!')
      setActiveTab('loans')
    } catch (err) {
      alert('Error creating loan')
    }
  }

  const handleRelease = async (loanId) => {
    if (window.confirm(`Are you sure you want to release loan ${loanId}?`)) {
      try {
        await axios.put(`${API_BASE}/loans/${loanId}/release`)
        fetchData()
        alert('Loan Released Successfully!')
      } catch (err) {
        alert('Error releasing loan')
      }
    }
  }

  const getFilteredLoans = () => {
    let filtered = loans
    if (selectedCustomer) {
      filtered = filtered.filter(l => l.phone === selectedCustomer)
    }
    if (searchTerm) {
      filtered = filtered.filter(l => 
        l.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        l.phone.includes(searchTerm) ||
        l.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    return filtered
  }

  const customers = Array.from(new Set(loans.map(l => l.phone))).map(phone => {
    const customerLoans = loans.filter(l => l.phone === phone)
    return {
      phone,
      name: customerLoans[0].name,
      totalLoans: customerLoans.length,
      totalActiveLoans: customerLoans.filter(l => l.status === 'Active').length,
      totalAmount: customerLoans.reduce((sum, l) => sum + l.amount, 0)
    }
  })

  const navItems = [
    { id: 'dashboard', label: 'Overview' },
    { id: 'new', label: 'New Loan' },
    { id: 'loans', label: 'Ledger' },
    { id: 'customers', label: 'Customers' }
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-gold-primary selection:text-black pb-10">
      {/* Navbar */}
      <nav className="bg-black/90 backdrop-blur-xl border-b border-gold-primary/20 sticky top-0 z-50 px-4 md:px-8 py-4 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-gold-primary rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-gold-primary/20">
            <span className="text-black font-black text-lg md:text-xl">S</span>
          </div>
          <h1 className="text-lg md:text-2xl font-black bg-gradient-to-r from-gold-primary via-yellow-200 to-gold-secondary bg-clip-text text-transparent tracking-tight">
            SUSH&apos;S GOLD VAULT
          </h1>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-2">
          {navItems.map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedCustomer(null); }} 
              className={`px-4 py-2 rounded-xl font-bold transition-all duration-300 ${activeTab === tab.id ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/30 scale-105' : 'text-gray-400 hover:text-gold-primary hover:bg-gold-primary/10'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 text-gold-primary"
        >
          {isMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
          )}
        </button>
      </nav>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)}>
        <div className={`absolute right-0 top-0 h-full w-64 bg-gray-900 shadow-2xl p-6 space-y-4 transition-transform duration-300 transform ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`} onClick={e => e.stopPropagation()}>
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Navigation</h2>
          {navItems.map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedCustomer(null); setIsMenuOpen(false); }} 
              className={`w-full text-left px-5 py-3 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-gold-primary text-black' : 'text-gray-400 hover:bg-gray-800'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-4 md:p-12 max-w-7xl mx-auto space-y-8 md:space-y-12">
        {activeTab === 'dashboard' && <Dashboard stats={stats} isLoading={isLoading} />}
        {activeTab === 'new' && <NewLoanForm formData={formData} onChange={handleInputChange} onSubmit={handleSubmit} />}
        {activeTab === 'loans' && (
          <LoanList 
            loans={getFilteredLoans()} 
            searchTerm={searchTerm} 
            setSearchTerm={setSearchTerm} 
            onRelease={handleRelease} 
            selectedCustomer={selectedCustomer}
            onClearFilter={() => setSelectedCustomer(null)}
          />
        )}
        {activeTab === 'customers' && (
          <CustomerRecords 
            customers={customers} 
            onViewLoans={(phone) => { setSelectedCustomer(phone); setActiveTab('loans'); }} 
          />
        )}
      </main>

      <footer className="py-8 text-center text-gray-700 border-t border-gray-900/50 mt-10">
        <p className="text-[10px] uppercase font-bold tracking-widest">© 2026 Sushmitha Akka Gold Shop • Gold Standard Security</p>
      </footer>
    </div>
  )
}

function Dashboard({ stats, isLoading }) {
  if (isLoading) return <div className="flex justify-center items-center h-64"><div className="w-12 h-12 border-4 border-gold-primary border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="space-y-6 md:space-y-12 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
        {[
          { title: 'Gold Received', value: stats.totalGoldReceived, unit: 'G' },
          { title: 'Gold In Store', value: stats.goldInStore, unit: 'G' },
          { title: 'Gold Released', value: stats.goldReleased, unit: 'G' }
        ].map(item => (
          <div key={item.title} className="bg-gray-900 border border-gray-800 p-6 md:p-8 rounded-2xl md:rounded-3xl hover:border-gold-primary/40 transition-all">
            <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">{item.title}</h3>
            <p className="text-2xl md:text-3xl font-black">{item.value}<span className="text-gold-primary text-sm ml-1">{item.unit}</span></p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
        <div className="bg-gradient-to-br from-gold-primary to-yellow-600 p-8 md:p-10 rounded-2xl md:rounded-[2.5rem] shadow-xl overflow-hidden relative">
          <div className="relative z-10">
            <h4 className="text-black/80 font-black uppercase text-sm tracking-widest mb-10">Liquidity Index</h4>
            <p className="text-black/60 text-[10px] font-bold uppercase tracking-widest mb-1">Active Collateral Value</p>
            <p className="text-black text-4xl md:text-6xl font-black">₹{parseFloat(stats.totalActiveLoanAmount).toLocaleString()}</p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
             <svg width="200" height="200" viewBox="0 0 24 24" fill="black"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8l1.46 1.46c-.1.43-.16.88-.16 1.34 0 2.21 1.79 4 4 4s4-1.79 4-4c0-.46-.06-.91-.16-1.34l1.46-1.46c.45.83.7 1.79.7 2.8 0 3.31-2.69 6-6 6zm0-10c-1.1 0-2 .9-2 2 0 .37.1.71.27 1.01l1.72-1.72c-.01-.01-.01-.01 0-.01.01 0 .01.01.01.01l1.72 1.72c.17-.3.27-.64.27-1.01 0-1.1-.9-2-2-2z"/></svg>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-500 text-[10px] font-black uppercase mb-3">Total Files</p>
            <p className="text-2xl font-black">{stats.totalLoans}</p>
          </div>
          <div className="bg-green-950/20 border border-green-900/40 p-6 rounded-2xl">
            <p className="text-green-500 text-[10px] font-black uppercase mb-3">Active</p>
            <p className="text-2xl font-black text-green-400">{stats.activeLoansCount}</p>
          </div>
          <div className="bg-blue-950/20 border border-blue-900/40 p-6 rounded-2xl col-span-2">
            <p className="text-blue-500 text-[10px] font-black uppercase mb-3">Settled Cases</p>
            <p className="text-2xl font-black text-blue-400">{stats.closedLoansCount}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewLoanForm({ formData, onChange, onSubmit }) {
  return (
    <div className="max-w-3xl mx-auto bg-gray-900 p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-gray-800 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">Initialize Pledge</h2>
        <p className="text-gray-500 text-xs md:text-sm font-medium">Record collateral & financial terms</p>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {[
          { label: 'Customer Full Name', name: 'name', type: 'text', placeholder: 'Enter Name' },
          { label: 'Mobile Number', name: 'phone', type: 'tel', placeholder: '987XXXXXXX' },
          { label: 'Gold Weight (g)', name: 'weight', type: 'number', placeholder: '0.00', step: '0.01' },
          { label: 'Purity Level', name: 'purity', type: 'select', options: ['22K', '24K', '18K'] },
          { label: 'Loan Amount (₹)', name: 'amount', type: 'number', placeholder: 'Principal' },
          { label: 'Interest Rate %', name: 'interest', type: 'number', placeholder: '2.0', step: '0.1' },
          { label: 'Pledge Date', name: 'date', type: 'date', span: true },
        ].map(field => (
          <div key={field.name} className={`space-y-2 ${field.span ? 'md:col-span-2' : ''}`}>
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{field.label}</label>
            {field.type === 'select' ? (
              <select 
                name={field.name} value={formData[field.name]} onChange={onChange}
                className="w-full bg-black border border-gray-800 text-white rounded-xl md:rounded-2xl px-5 py-3 md:py-4 focus:ring-2 focus:ring-gold-primary/50 outline-none hover:border-gray-700 transition-all font-bold"
              >
                {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input 
                required type={field.type} name={field.name} value={formData[field.name]} onChange={onChange} step={field.step}
                placeholder={field.placeholder}
                className="w-full bg-black border border-gray-800 text-white rounded-xl md:rounded-2xl px-5 py-3 md:py-4 focus:ring-2 focus:ring-gold-primary/50 outline-none hover:border-gray-700 transition-all placeholder:text-gray-800 font-bold" 
              />
            )}
          </div>
        ))}
        <button 
          type="submit"
          className="md:col-span-2 bg-gradient-to-r from-gold-primary to-yellow-500 text-black font-black py-4 md:py-5 rounded-xl md:rounded-2xl hover:scale-[1.01] transition-all active:scale-95 shadow-xl shadow-gold-primary/20 uppercase tracking-widest mt-2"
        >
          Issue Loan
        </button>
      </form>
    </div>
  )
}

function LoanList({ loans, searchTerm, setSearchTerm, onRelease, selectedCustomer, onClearFilter }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">Pledge Ledger</h2>
          <p className="text-gray-500 text-sm font-medium">{selectedCustomer ? 'Filtered by Client' : 'Live management of all active assets'}</p>
          {selectedCustomer && (
            <button onClick={onClearFilter} className="mt-4 text-[10px] font-black text-gold-primary uppercase tracking-widest border border-gold-primary/30 px-3 py-1.5 rounded-full hover:bg-gold-primary/10 flex items-center gap-1.5">
              <span>✕</span> Clear Filter
            </button>
          )}
        </div>
        <div className="relative w-full lg:w-[28rem]">
          <input 
            type="text" 
            placeholder="Search Record..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 text-white rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-gold-primary/30 font-bold placeholder:text-gray-700"
          />
        </div>
      </div>

      {/* Responsive Ledger View */}
      <div className="space-y-4">
        {/* Desktop Header Hidden on Mobile */}
        <div className="hidden lg:grid grid-cols-6 gap-4 px-8 py-4 bg-gray-900/50 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-widest">
           <div>Identity</div>
           <div>Collateral</div>
           <div>Metric</div>
           <div>Principal</div>
           <div>Status</div>
           <div className="text-right">Action</div>
        </div>

        {/* Content */}
        {loans.length > 0 ? loans.map(loan => (
          <div key={loan.id} className="bg-gray-900 border border-gray-800 rounded-2xl md:rounded-[2rem] overflow-hidden group">
            {/* Mobile View: Card Style */}
            <div className="lg:hidden p-5 flex flex-col gap-4">
               <div className="flex justify-between items-start">
                  <div>
                    <div className="text-gold-primary font-black text-xs uppercase tracking-widest mb-1">{loan.id}</div>
                    <div className="text-white font-black text-lg">{loan.name}</div>
                    <div className="text-gray-500 text-xs font-bold">{loan.phone}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${loan.status === 'Active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                    {loan.status}
                  </span>
               </div>
               
               <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-800/50">
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Pledge</p>
                    <p className="font-bold text-gray-300">{loan.weight}g <span className="text-gold-primary/60">{loan.purity}</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Interest</p>
                    <p className="font-bold text-gray-300">{loan.interest}%/mo</p>
                  </div>
               </div>

               <div className="flex justify-between items-center bg-black/40 p-4 -mx-5 -mb-5">
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase">Principal Sum</p>
                    <p className="text-lg font-black text-white">₹{loan.amount.toLocaleString()}</p>
                  </div>
                  {loan.status === 'Active' ? (
                    <button 
                      onClick={() => onRelease(loan.id)}
                      className="bg-gold-primary text-black text-[10px] font-black uppercase tracking-widest px-6 py-2.5 rounded-xl active:scale-95 shadow-lg shadow-gold-primary/20"
                    >
                      Release
                    </button>
                  ) : (
                    <div className="text-[10px] text-gray-600 font-black uppercase italic">Settled {new Date(loan.releasedDate).toLocaleDateString()}</div>
                  )}
               </div>
            </div>

            {/* Desktop View: Table Row */}
            <div className="hidden lg:grid grid-cols-6 gap-4 px-8 py-6 items-center">
               <div className="font-black text-gold-primary text-base">{loan.id}<br/><span className="text-white text-sm font-bold tracking-tight">{loan.name}</span></div>
               <div className="text-gray-300 font-bold">{loan.weight}g <span className="text-gold-primary/40 text-xs">{loan.purity}</span></div>
               <div className="text-gray-300 font-bold">{loan.interest}% <span className="text-xs text-gray-500 font-medium">mo</span></div>
               <div className="text-white font-black text-lg">₹{loan.amount.toLocaleString()}</div>
               <div>
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${loan.status === 'Active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                    <span className={`w-1 h-1 rounded-full ${loan.status === 'Active' ? 'bg-green-400' : 'bg-gray-500'}`}></span>
                    {loan.status}
                  </span>
               </div>
               <div className="text-right">
                {loan.status === 'Active' ? (
                  <button onClick={() => onRelease(loan.id)} className="bg-black border border-gold-primary/30 text-gold-primary text-[10px] font-black uppercase px-4 py-2 rounded-lg hover:bg-gold-primary hover:text-black transition-all">Release</button>
                ) : (
                  <span className="text-[10px] text-gray-600 font-black uppercase italic">Settled</span>
                )}
               </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-gray-900 border border-gray-800 rounded-3xl">
             <p className="text-gray-600 font-black uppercase tracking-widest">No matching records found</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CustomerRecords({ customers, onViewLoans }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <h2 className="text-3xl md:text-4xl font-black text-white">Client Portfolio</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {customers.map(c => (
           <div key={c.phone} className="bg-gray-900 border border-gray-800 p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] hover:border-gold-primary/50 transition-all">
              <div className="flex justify-between items-start mb-6">
                 <div className="w-12 h-12 md:w-16 md:h-16 bg-black rounded-xl md:rounded-2xl flex items-center justify-center font-black text-gold-primary text-xl md:text-2xl border border-gray-800">
                    {c.name.charAt(0)}
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Active Cases</p>
                    <p className="text-xl md:text-2xl font-black text-green-400">{c.totalActiveLoans}</p>
                 </div>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white mb-1 line-clamp-1">{c.name}</h3>
              <p className="text-gray-500 font-bold text-xs md:text-sm mb-6">{c.phone}</p>
              
              <div className="grid grid-cols-2 gap-3 bg-black/60 p-4 rounded-xl md:rounded-2xl mb-6">
                 <div>
                    <p className="text-[8px] font-black text-gray-600 uppercase mb-1">Total Files</p>
                    <p className="font-bold text-gray-300 text-sm">{c.totalLoans}</p>
                 </div>
                 <div>
                    <p className="text-[8px] font-black text-gray-600 uppercase mb-1">Pledged Value</p>
                    <p className="font-bold text-gold-primary text-sm">₹{c.totalAmount.toLocaleString()}</p>
                 </div>
              </div>

              <button 
                onClick={() => onViewLoans(c.phone)}
                className="w-full bg-gray-800 hover:bg-gold-primary hover:text-black py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Full History
              </button>
           </div>
        ))}
      </div>
    </div>
  )
}

export default App
