const Tips = require('./tips');
const IS = require('is');
const php_date = require('locutus/php/datetime/date');
const strtotime = require('locutus/php/datetime/strtotime');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const PY_translator=require('pinyin');
const db = require('../db/index');
const csv = require('csvjson');
const iconv = require('iconv-lite');

let util = {
    formatData(params, valids) {
        let res = true;
        if (!IS.object(params) || !IS.array(valids)) return false;
        for (let i = 0; i < valids.length; i++) {
            let e = valids[i];
            let {key, type} = e;
            if (!key) {
                res = false;
                break;
            }
            let value = params[key] || '';
            if (type === 'not_empty') {
                if (IS.empty(value)) {
                    res = false;
                    break;
                }
            } else if (type === 'number') {
                value = Number(value);
                if (!IS.number(value) || IS.nan(value)) {
                    res = false;
                    break;
                }
            } else if(type === 'reg'){
                let reg = e['reg'];
                if(!reg || !reg.test(value)){
                    res = false;
                    break;
                }
            }else {
                if (!IS[type](value)) {
                    res = false;
                    break;
                }
            }
        }
        return res;
    },
    filter(params, filterArr) {
        if (IS.object(params) && IS.array(filterArr)) {
            let data = {};
            filterArr.forEach(e => {
                let val = params[e];
                if (!IS.undefined(val) && !IS.null(val) && !IS.empty(val) || IS.array.empty(val)) {
                    data[e] = val;
                }
            });
            return data;
        } else {
            return params;
        }
    },
    formatCurrentTime(create_time) {
        let time = create_time ? strtotime(create_time) * 1000: Date.now();
        return php_date('Y-m-d H:i:s', time/1000);
    },
    checkLogin(ctx) {
        let uid = ctx.cookies.get('uid');
        return !uid ? Tips[1005] : Tips[0];
    },
    generateToken(data) {
        let created = Math.floor(Date.now() / 1000);
        let cert = fs.readFileSync(path.join(__dirname, '../config/pri.pem'));
        let token = jwt.sign({
            data,
            exp: created + 3600 * 24
        }, cert, {algorithm: 'RS256'});
        return token;
    },
    verifyToken(token){
        let cert = fs.readFileSync(path.join(__dirname, '../config/pub.pem')),res = {};
        try {
            let result = jwt.verify(token, cert, {algorithms: ['RS256']}) || {};
            let {exp = 0} = result, current = Math.floor(Date.now()/1000);
            if (current <= exp) {
                res = result.data || {};
            }
        }catch (e) {

        }
        return res;
    },
    generateJSON(data) {
        const JSON_data = [];
        data.forEach((part, index) => {
            const the_part = {};
            const part_index = index;
            the_part['step_description'] = part.name;
            the_part['items'] = [];
            part.data.splice(0, 2);
            part.data.forEach((item, index) => {
                if (item.length !== 0) {
                    const temp_item = {};
                    temp_item['name'] = item[0];
                    let temp_id = `part${part_index}_${PY_translator(item[0], {style: PY_translator.STYLE_FIRST_LETTER})}`;

                    temp_item['id'] = temp_id.split(',').join('');
                    if (item[3]) {
                        if (item[3].split('/').length > 1 || item[3].split(',').length > 1) {
                            temp_item['type'] = 'radio';
                        } else {
                            temp_item['type'] = 'input';
                        }
                    } else {
                        temp_item['type']= 'input';
                    }
                    item[4] ? temp_item['unit'] = item[4] : temp_item['unit'] = '';
                    the_part['items'].push(temp_item);
                }
            });
            JSON_data.push(the_part);
        });
        return JSON_data;
    },
    generateSQL(data) {
        const sql_set = [];
        const part1 = data[0];
        part1.data.forEach((item, index) => {
            let name = `PART1_${PY_translator(item[0], {style: PY_translator.STYLE_FIRST_LETTER})}`;
            let type = this.generateType(item[1]);
            sql_set.push(`${name.split(',').join('')} ${type}`)
        });
        sql_set.push(`PRIMARY KEY(PART1_zyh)`);
        const sql_sentence = `create table if not exists PART1(${sql_set.join(',')}) CHARSET=utf8;`;
        db.query(sql_sentence).then(res => {
            console.log(res);
        }).catch(e => {
            console.log(e);
        });
    },
    parseCSV() {
        let csv_buffer = Buffer.from(fs.readFileSync(path.join(__dirname, '../data/Home_page.csv') , {encoding: 'binary'}), 'binary');
        let csv_file = iconv.decode(csv_buffer, 'GBK');
        const options = {
            delimiter : ',', // optional
            quote     : '"' // optional
        };
       const Data_section = csv.toObject(csv_file, options).slice(0, 9);
       this.saveData(Data_section[0], Data_section);
    },
    saveData(data, data_array) {
        const D_keys = Object.keys(data);
        const D_sqls = [];
        D_keys.forEach(item => {
            const item_sql = `PART1_${PY_translator(item, {style: PY_translator.STYLE_FIRST_LETTER})}`;
            D_sqls.push(item_sql.split(',').join(''));
        });
        const sql = `INSERT INTO PART1 (${D_sqls.join(',')}) VALUES ?`;
        const values = [];
        data_array.forEach((item) => {
            const value_arr = [];
            Object.keys(item).forEach(key => {
                if (key === '病理号')
                value_arr.push(0);
                else value_arr.push(item[key]);
            });
            values.push(value_arr);
        });
        db.query(sql, [values]).then(res => {
            console.log(res.affectedRows);
        }).catch(err => {
            console.log(err);
        })
    },
    generateType(type) {
        switch (type) {
            case '数字':
                return 'INT';
            case '长数字':
                return 'BIGINT';
            case '字符串':
                return 'VARCHAR(300)';
            case '数值':
                return 'INT';
            case '时间':
                return 'VARCHAR(60)';
            default:
                return 'TEXT'
        }
    }
};

module.exports = util;