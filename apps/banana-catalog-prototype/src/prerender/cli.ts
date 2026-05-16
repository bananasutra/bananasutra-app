import { renderRoute } from './runner'

const pathname = process.argv[2] ?? '/'
const result = renderRoute(pathname)
process.stdout.write(JSON.stringify(result))
