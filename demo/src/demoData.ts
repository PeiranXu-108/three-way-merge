export const oldContent = `{
  "name": "ExampleConfig",
  "version": 1,
  "description": "Initial configuration file",
  "features": {
    "search": true,
    "share": false,
    "export": false,
    "analytics": true,
    "debug": false
  },
  "limits": {
    "maxItems": 50,
    "timeout": 5000,
    "cacheSize": 100
  },
  "theme": {
    "primary": "#1890ff",
    "mode": "light"
  },
  "metadata": {
    "owner": "team-a",
    "createdAt": "2023-06-01",
    "deprecated": true
  },
  "notes": [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
    "iota",
    "kappa",
    "lambda",
    "mu",
    "nu",
    "xi",
    "omicron",
    "pi",
    "rho",
    "sigma",
    "tau",
    "upsilon",
    "phi",
    "chi",
    "psi",
    "omega"
  ],
  "legacy": {
    "enabled": true,
    "version": "1.0"
  }
}`;

export const newContent = `{
  "name": "ExampleConfig",
  "version": 2,
  "features": {
    "search": true,
    "share": true,
    "export": true,
    "notifications": true,
    "darkMode": false
  },
  "limits": {
    "maxItems": 100,
    "timeout": 3000,
    "rateLimit": 1000
  },
  "theme": {
    "primary": "#1677ff",
    "mode": "light",
    "accent": "#52c41a"
  },
  "metadata": {
    "owner": "team-b",
    "createdAt": "2024-01-15",
    "updatedAt": "2025-02-10",
    "tags": ["production", "v2"]
  },
  "notes": [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
    "iota",
    "kappa",
    "lambda",
    "mu",
    "nu",
    "xi",
    "omicron",
    "pi",
    "rho",
    "sigma",
    "tau",
    "upsilon",
    "phi",
    "chi",
    "psi",
    "omega",
    "extra"
  ],
  "security": {
    "encryption": true,
    "apiKey": "required"
  }
}`;
