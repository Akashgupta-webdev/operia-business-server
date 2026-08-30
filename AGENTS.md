# AI Agent Instructions

- This repository is an insurance CRM server for administrators and agents, built with Express.js, MongoDB, and the existing project stack.
- Before every code change, read the relevant documentation in `docs/` and ensure the implementation matches the documented business rules.
- Reuse existing functions, services, and modules whenever possible. If necessary, make small, backward-compatible improvements so existing code can serve multiple use cases instead of creating duplicate functionality.
- Keep responsibilities separated: place components and modules in appropriate files rather than putting unrelated logic in one file.
- Follow SOLID principles and the project's existing conventions when writing or modifying code.

# API Rules
- Controller function should have try and catch expression so error can be send in response and console in terminal for watch useful logs
- Implement database operation on service folder of their respective module
- Every important function should have a proper two line comment (for Human and AI agent)
- Every function created should have proper name defining their work
- Every repetive function that is being used in more than two module should be place in shared folder
- Create utility function in utils folder