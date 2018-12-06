const http = require('http');
const koa = require('koa');
const etag = require('koa-etag');
const bodyParser = require('koa-bodyparser');
const errorHandler = require('koa-error');
const compress = require('koa-compress');
const log = global.console.log.bind(console);
const PORT = process.env.PORT || 8080;
const koaBody = require('koa-body');
const app = new koa();
const Utils = require('./utils/methods');
const router = require('./router');
const Tips = require('./utils/tips');
const fs = require('fs');
const path = require('path');
const xlsx = require('node-xlsx');

app.use(koaBody());

app.use(async(ctx, next) => {
    let {url = ''} = ctx;
    if (url.indexOf('/oa/user/') > -1) {
        let header = ctx.request.header;
        let {loginedtoken} = header;

        console.log(loginedtoken);
        if (loginedtoken) {
            let result = Utils.verifyToken(loginedtoken);
            let {uid} = result;
            if(uid) {
                ctx.state = {uid};
                await next();
            } else {
                return ctx.body = Tips[1005];
            }
        } else {
            return ctx.body = Tips[1005];
        }
    } else {
        await next();
    }
});
app.use(errorHandler());
app.use(bodyParser());
app.use(etag());

app.use(compress({
    filter: contentType => /text|javascript/i.test(contentType),
    threshold: 2048
}));
router(app);
http.createServer(app.callback()).listen(PORT);
/*const xlsx_file = fs.readFileSync(path.join(__dirname, './data/oncology_key.xlsx'));
const json_data = xlsx.parse(xlsx_file);
const formatJSON = Utils.generateJSON(json_data);
Utils.generateSQL(json_data);
Utils.parseCSV();
fs.writeFileSync(path.join(__dirname, './data/oncology.json'), JSON.stringify(formatJSON), 'utf8', (err)=> {
    if (err) throw err;
});*/

log('server is running on port: %s', PORT);