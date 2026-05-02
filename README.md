# React + Vite

## Scheduloop day context

Day context tags let a business mark unusual calendar dates, such as
promotions, local events, roadworks, payday periods, holidays, or weather.
Context is stored on the selected date inside the business profile
`dayConfigs` map and is optional, so older day type-only entries still work.

The Shape of Day forecast applies context as a conservative rule-based demand
multiplier before demand is converted into staff. Defaults are starting
assumptions only; businesses should tag past and future days consistently so a
future version can learn business-specific effects by comparing similar tagged
days with similar untagged days.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
