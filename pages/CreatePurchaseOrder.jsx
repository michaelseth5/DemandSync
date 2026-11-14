import "../styles/ds-ui.css";
import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import ChatBot from "../components/ChatBot.jsx";
import { INVENTORY_MASTER } from "../data/inventoryMaster.js";

export default function CreatePurchaseOrder() {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [groupBy, setGroupBy] = useState("category");
  const [sortBy, setSortBy] = useState("risk");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [supplierFilter, setSupplierFilter] = useState("All Suppliers");
  const [searchQuery, setSearchQuery] = useState("");
  const [keyItemsOnly, setKeyItemsOnly] = useState(false);

  const filteredItems = useMemo(() => {
    let items = INVENTORY_MASTER.map(item => {
      const diff = item.parLevel - item.currentOnHand;
      const risk = diff > item.parLevel * 0.3 ? "high" : diff > item.parLevel * 0.15 ? "medium" : "low";
      const extendedCost = item.recommendedQty * item.unitCost;
      return {
        ...item,
        supplier: item.vendor,
        onHand: item.currentOnHand,
        lastWeekUsage: item.lastWeekUsage,
        forecastUsage: item.forecastUsage,
        recommendedQty: item.recommendedQty || 0,
        unitCost: item.unitCost,
        extendedCost,
        risk
      };
    });

    if (categoryFilter !== "All Categories") {
      items = items.filter(item => item.category === categoryFilter);
    }
    if (supplierFilter !== "All Suppliers") {
      items = items.filter(item => item.vendor === supplierFilter);
    }
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (keyItemsOnly) {
      items = items.filter(item => item.recommendedQty > 0);
    }

    if (sortBy === "risk") {
      items.sort((a, b) => {
        const riskOrder = { high: 3, medium: 2, low: 1 };
        return riskOrder[b.risk] - riskOrder[a.risk];
      });
    } else if (sortBy === "category") {
      items.sort((a, b) => a.category.localeCompare(b.category));
    } else if (sortBy === "supplier") {
      items.sort((a, b) => a.vendor.localeCompare(b.vendor));
    }

    if (groupBy !== "risk") items.sort((a,b) => String(groupBy === "supplier" ? a.vendor : a.category).localeCompare(String(groupBy === "supplier" ? b.vendor : b.category)));
    return items;
  }, [categoryFilter, supplierFilter, searchQuery, keyItemsOnly, sortBy, groupBy]);

  const summary = useMemo(() => {
    const selected = filteredItems.filter(item => selectedItems.has(item.id));
    const totalSpend = selected.reduce((sum, item) => sum + item.extendedCost, 0);
    return {
      totalSpend,
      totalItems: selected.length || filteredItems.filter(item => item.recommendedQty > 0).length,
      coverageDays: 7,
      trafficTrend: 8.3
    };
  }, [filteredItems, selectedItems]);

  const exportCsv = () => {
    const columns = ["name","category","supplier","onHand","parLevel","forecastUsage","recommendedQty","unitCost","extendedCost"];
    const rows = filteredItems.filter(item => selectedItems.size === 0 || selectedItems.has(item.id));
    const quote = value => '"' + String(value ?? "").replace(/"/g,'""') + '"';
    const csv = [columns.join(","), ...rows.map(row => columns.map(key => quote(row[key])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a");
    link.href=url; link.download="demandsync-purchase-suggestions.csv"; link.click();
    URL.revokeObjectURL(url);
  };
  const toggleItem = (id) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  return (
    <div className="ds-ui ds-purchase">
      
      
      <div className="page-container">
        <div className="header-card">
          <Link to="/" style={{ color: "white", textDecoration: "none", fontSize: 14, marginBottom: 16, display: "block" }}>← Back to Dashboard</Link>
          <h1 className="page-title">Create Purchase Order</h1>
          <p className="page-subtitle">Build a recommended order based on usage, traffic, and par levels</p>
        </div>

        <div className="filter-bar">
          <div className="filter-item">
            <select>
              <option>Uptown Dallas</option>
              <option>Plano</option>
              <option>Houston</option>
            </select>
          </div>
          <div className="filter-item">
            <select>
              <option>All Suppliers</option>
              <option>US Foods</option>
              <option>Sysco</option>
              <option>Seafood Vendor</option>
              <option>Republic National</option>
            </select>
          </div>
          <div className="filter-item">
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option>All Categories</option>
              <option>Produce</option>
              <option>Meats</option>
              <option>Dry Storage</option>
              <option>Spices</option>
              <option>Liquor</option>
              <option>Wine</option>
            </select>
          </div>
          <div className="filter-item">
            <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
              <option>All Suppliers</option>
              <option>US Foods</option>
              <option>Sysco</option>
              <option>Produce Vendor</option>
              <option>Seafood Vendor</option>
              <option>Republic National</option>
              <option>Wine Vendor</option>
            </select>
          </div>
          <div className="filter-item">
            <input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <div className="filter-item">
            <label><input type="checkbox" checked={keyItemsOnly} onChange={(e) => setKeyItemsOnly(e.target.checked)} /> Include Only Key Items</label>
          </div>
          <div className="filter-item">
            <input type="text" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-label">Total Suggested Spend</div>
            <div className="summary-value">${summary.totalSpend.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Suggested Items</div>
            <div className="summary-value">{summary.totalItems}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Expected Coverage</div>
            <div className="summary-value">{summary.coverageDays} days</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Traffic Trend</div>
            <div className="summary-value">+{summary.trafficTrend}%</div>
          </div>
        </div>

        <div className="main-content">
          <div className="table-card">
            <div className="table-header">
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Suggested Items ({filteredItems.length})</h2>
              <div className="table-controls">
                <select aria-label="Group by" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                  <option value="category">Group by Category</option>
                  <option value="supplier">Group by Supplier</option>
                  <option value="risk">Group by Risk</option>
                </select>
                <select aria-label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="risk">Sort by Risk</option>
                  <option value="category">Sort by Category</option>
                  <option value="supplier">Sort by Supplier</option>
                </select>
              </div>
            </div>
            <div className="ds-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" aria-label="Select all visible items" checked={filteredItems.length > 0 && filteredItems.every(item => selectedItems.has(item.id))} onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems(prev => new Set([...prev, ...filteredItems.map(item => item.id)]));
                      } else {
                        setSelectedItems(prev => { const next = new Set(prev); filteredItems.forEach(item => next.delete(item.id)); return next; });
                      }
                    }} /></th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Supplier</th>
                    <th>Par Level</th>
                    <th>On Hand</th>
                    <th>Last Week Usage</th>
                    <th>Forecast Usage</th>
                    <th>Recommended Qty</th>
                    <th>Unit Cost</th>
                    <th>Extended Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 && <tr><td colSpan={11} className="ds-empty">No items match your filters.</td></tr>}
                  {filteredItems.map(item => (
                    <tr key={item.id} className={item.recommendedQty > 0 && item.risk === "high" ? "ds-row-risk" : ""}>
                      <td><input type="checkbox" className="checkbox" aria-label={`Select ${item.name}`} checked={selectedItems.has(item.id)} onChange={() => toggleItem(item.id)} /></td>
                      <td>{item.name}</td>
                      <td>{item.category}</td>
                      <td>{item.supplier}</td>
                      <td>{item.parLevel}</td>
                      <td>{item.onHand}</td>
                      <td>{item.lastWeekUsage}</td>
                      <td>{item.forecastUsage}</td>
                      <td><strong>{item.recommendedQty}</strong></td>
                      <td>${item.unitCost.toFixed(2)}</td>
                      <td><strong>${item.extendedCost.toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="action-buttons">
              <button className="btn btn-primary">Rebuild Suggestions</button>
              <button className="btn btn-secondary">Reset to Par Only</button>
              <button className="btn btn-secondary" onClick={exportCsv}>Export to CSV</button>
              <button className="btn btn-primary">Create Purchase Order</button>
              <button className="btn btn-secondary">Save as Draft</button>
            </div>
          </div>
        </div>
      </div>
      <ChatBot />
    </div>
  );
}

