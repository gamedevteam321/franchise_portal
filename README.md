# Franchise Portal

Custom franchise signup interface for multi-step franchise onboarding process.

## Features

- Multi-step franchise application form
- Custom Doctype for storing application data
- Email notifications for administrators
- Web interface for applicants

## Installation

1. `bench get-app franchise_portal`
2. `bench --site [site-name] install-app franchise_portal`

## Usage

Access the signup form at: `/signup`

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/franchise_portal
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### CI

This app can use GitHub Actions for CI. The following workflows are configured:

- CI: Installs this app and runs unit tests on every push to `develop` branch.
- Linters: Runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and [pip-audit](https://pypi.org/project/pip-audit/) on every pull request.


### License

mit
