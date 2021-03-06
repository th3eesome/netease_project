const router = require('koa-router')();
const Utils = require('../utils/methods');
const Tips = require('../utils/tips');
const db = require('../db/index');
const _ = require('lodash');

const basic_conditions = {
    patientID: 'part1_zylsh',
    patientName: 'part1_xm',
    Disease: 'part1_zzd'
};

router.get('/oa/patients' ,async (ctx, next) => {
    let sql = 'SELECT * FROM PART1;';
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

router.get('/oa/patient/:hos_id', async(ctx, next) => {
   let params = ctx.params;
   let {hos_id} = params;
   let sql = `SELECT * FROM PART1 WHERE PART1_zyh=${hos_id}`;
   await db.query(sql).then(res => {
       Utils.cleanData(res);
       ctx.body = {...Tips[0], data: res[0]}
   }).catch(e => {
       ctx.body = {...Tips[1002], reason:e}
   })
});

router.get('/oa/patient_1/:zyh', async(ctx, next) => {
    let params = ctx.params;
    let {zyh} = params;
    let sql_home = `SELECT * FROM FIRST_HOME WHERE part1_zylsh='${zyh}'`;
    let sql_advice = `SELECT * FROM FIRST_ADVICE WHERE part2_zyh = '${zyh}'`;
    const home = await db.query(sql_home);
    const advice = await db.query(sql_advice);
    Promise.all([home, advice]).then(res => {
       // Utils.cleanData(res);
        ctx.body = {...Tips[0], data: {home: res[0], advice: Utils.generateCategory(res[1], 'part2_yzlb')}}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason:e}
    })
});

router.get('/oa/patients_2' ,async (ctx, next) => {
    let sql = 'SELECT part1_pid, part1_bah, part1_xm, part1_nl, part1_xb, part1_cysj FROM SECOND_HOME;';
    await db.query(sql).then(res => {
        Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res.slice(0, 10)}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

router.get('/oa/patient_2/:hos_pid', async(ctx, next) => {
    let params = ctx.params;
    let {hos_pid} = params;
    let fee_sql = `SELECT * FROM  SECOND_FEE WHERE PART1_bah = ${hos_pid};`;
    let home_sql = `SELECT * FROM  SECOND_HOME WHERE PART1_bah = ${hos_pid};`;
    const home_db = await db.query(home_sql);
    const fee_db = await db.query(fee_sql);
    Promise.all([home_db, fee_db]).then(res => {
        Utils.cleanData(res[0]);
        delete res[1][0]['part1_bah'];
        ctx.body = {
            state: 200,
            data: {
                part1: res[0][0],
                part2: res[1][0]
            }
        }
    }).catch(e => {
        ctx.body = {state: 500, error: e}
    });
});


//post方法实现一附院所有病人病案首页信息分页
router.post('/oa/patients1/',async (ctx, next) =>{
    var pagesize = parseInt(ctx.request.body.pagesize);
    var pageindex = parseInt(ctx.request.body.pageindex);

    var conditions = ctx.request.body.condition;
    const condition_array = [];
    /*Object.keys(conditions).forEach(key => {
        if (conditions[key] !== '') {
            condition_array.push(`${basic_conditions[key]} = '${conditions[key]}'`);
        }
    });*/
    const condition_sql = 'WHERE ' + condition_array.join(' AND ');
    const start = (pageindex-1) * pagesize;
    let sql1 = `SELECT * FROM FIRST_HOME  ${condition_array.length === 0 ? '' :condition_sql} limit ${start},${pagesize};`;
    let sql2 = `SELECT COUNT(*) FROM FIRST_HOME ${condition_array.length === 0 ? '' :condition_sql};`;
    //console.log(sql1);
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        num = res[1][0]['COUNT(*)'];
        data = res[0];
        //Utils.cleanData(res);
        ctx.body = {...Tips[0],count_num:num,data:data};

    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })
});

//通过pid获取一附院病人病案首页信息
router.get('/oa/patient1/:pid/:zyh',async(ctx,next) => {

    let {pid, zyh} = ctx.params;
    await queryPatient(pid, zyh).then((res) => {
        ctx.body = {
            ...Tips[0],
            data: {
                home: res[0],
                advice: Utils.generateCategory(res[1], 'part2_yzlb'),
                lis: Utils.generateCategory(res[2], 'part3_xmmc'),
                mazui: res[3],
                results: Utils.generateCategory(res[4], 'part5_jclb')
            }
        }
    }).catch(e => {
        ctx.body = {
            ...Tips[1002],
            error: e
        }
    })
});

router.get('/oa/es_list/', async (ctx, next) => {
    let {query} = ctx.query;
    const related_zyh = [];
    await db.es().search({
        body: {
            highlight: {
                require_field_match: false,
                fields: {
                    "*": {}
                }
            },
            query: {
                query_string: {
                    query: query
                }
            }
        },
        _source: [
            'part5_zyh'
        ]
    }).then(async (res)=> {

        res['hits']['hits'].forEach(item => {
            related_zyh.push(item._source['part5_zyh']);
        });

        const uniq_zyh = _.uniq(related_zyh);
        await queryHome(uniq_zyh).then(res => {
            ctx.body = {status: res};
        }).catch(e => {
            ctx.body = {status: e}
        })
    }).catch(e => {
        console.log(e);
        console.log('es down');
    });
});



async function queryHome(zyh_array) {
    const zyh = zyh_array.join(',');
    const home_fields = ['part1_pid', 'part1_zyh', 'part1_zylsh', 'part1_xm', 'part1_xb', 'part1_nl', 'part1_zzd', 'part1_rysj', 'part1_cysj'];
    return db.query(`SELECT ${home_fields.join(',')} FROM FIRST_HOME WHERE part1_zyh IN (${zyh})`);
}

async function queryPatient(id, lsh) {
    const zyh = lsh.substr(7, 7);
    const home_data = db.query(`SELECT * FROM FIRST_HOME WHERE part1_pid = ${id}`);
    const advice_data = db.query(`SELECT * FROM FIRST_ADVICE WHERE part2_zyh = '${lsh}'`);
    const lis_data = db.query(`SELECT * FROM FIRST_LIS WHERE part3_zylsh = '${lsh}'`);
    const mazui_data = db.query(`SELECT * FROM FIRST_MAZUI WHERE part4_zylsh = '${lsh}'`);
    const results_data = db.query(`SELECT * FROM FIRST_RESULTS WHERE part5_zyh = ${zyh}`);
    return await Promise.all([home_data, advice_data, lis_data, mazui_data, results_data]);
}

function unique (arr) {
    const seen = new Map();
    return arr.filter((a) => !seen.has(a) && seen.set(a, 1));
}

var dateModify = function (x) {
    let time_init = x.replace(/^\s/,'').split(' ')[0];
    let [year,month,day] = time_init.split('/');
    month = month < 10 ? ('0' + month) : month;
    day = day <10 ? ('0' + day) : day;
    let time = [year,month,day].join('-');
    return time;
    //console.log(element.part1_rysj);
};


//post方法实现二附院所有病人病案首页信息分页
router.post('/oa/patients2',async (ctx, next) =>{
    var pagesize = parseInt(ctx.request.body.pagesize);
    var pageindex = parseInt(ctx.request.body.pageindex);
    //var start = (pageindex-1) * pagesize;
    var start = pageindex -1;
    var conditions = ctx.request.body.conditions;
    var searchField = [];
    var formType = [];
    var logicValue = [];
    var where_array = [];
    var where = ''  ;
    var set = '';
    
    conditions.forEach(item => {
          searchField.push(item.databaseField);
          formType.push(item.form_type);
          logicValue.push(item.logicValue);
          //字符型查找
          if ((item.isNotNumber === true) && (item.isSelect === false)) {
              if (item.selectedValue === '包含') {
                  where_array.push(`(${item.databaseField} like '%${item.inputValue}%')`);
              }
              if (item.selectedValue === '等于') {
                  where_array.push(`(${item.databaseField} = '${item.inputValue}')`);
              }
          }
          //选择框查找
          if ((item.isNotNumber === true) && (item.isSelect === true)) {
  
              if (item.selectedInt != null) {
                  where_array.push(`(${item.databaseField} = ${item.selectedInt})`);
              }else {
                  where_array.push(`(${item.databaseField} = '${item.selectedValue}')`);
              }
          }
          //次数查找
          if (item.isNumber === true) {
              where_array.push(`(${item.databaseField} between ${item.inputValue1} and ${item.inputValue2})`);
          }
          //时间查找
          if (item.isTime === true) {
              where_array.push(`(${item.databaseField} between '${item.startTime}' and '${item.endTime}')`);
          }
    });

    where_array.forEach((item, index) => {
          if ( index === where_array.length - 1) {
              where = ` ${where}${item} `;
          }else {
              where = ` ${where}${item}  ${logicValue[index + 1]} `;
          }
    });
    
    // const set  = new Set(this.formType);
    searchField.push('part1_bah', 'part1_xm', 'part1_rysj', 'part1_ryzd');
    // set = searchField.join();
    let sql1 = `SELECT ${unique(searchField)} FROM ${unique(formType)} where ${where} limit ${start},${pagesize};`;
    console.log(sql1);
    // let sql1 = `SELECT * FROM SECOND_HOME limit ${start},${pagesize};`;
    // let sql1 = `SELECT * FROM SECOND_HOME limit ${start},${pagesize};`;

    let sql2 = 'SELECT COUNT(*) FROM SECOND_HOME;';
    //console.log(sql1);
    const part1 = await db.query(sql1);
    const part2 = await db.query(sql2);
    Promise.all([part1, part2]).then((res) => {
        num = res[1][0]['COUNT(*)'];
        data = res[0];
        //Utils.cleanData(res);
        data.forEach(function(element){
            if(element.part1_HIS === 0)
            {
                element.part1_csrq = dateModify(element.part1_csrq);
                element.part1_rysj = dateModify(element.part1_rysj);
                element.part1_cysj = dateModify(element.part1_cysj);
                //console.log(element.part1_rysj);
            }
        });
        ctx.body = {...Tips[0],count_num:num,data:data};

    }).catch((e) => {
        ctx.body = {...Tips[1002],reason:e}
    })
});




//给郑莹倩师姐：二附院根据表名和字段名提取该字段的所有数据
router.get('/oa/patients2/:table/:key',async(ctx,next) => {
    let params = ctx.params;
    //console.log(params);
    let {table,key} = params;
    //console.log(key);
    if (table === 'SECOND_HOME') id = 'part1_pid';
    else if (table === 'SECOND_FEE') id = 'part2_pid';
    else if(table === 'SECOND_LIS') id = 'part3_pid';
    const sql = `select ${id},${key} from ${table};`;
    await db.query(sql).then(res => {
        //Utils.cleanData(res);
        ctx.body = {...Tips[0], data: res}
    }).catch(e => {
        ctx.body = {...Tips[1002], reason: e}
    })
});

var isnum = function (x) {
    if(!Number.isNaN(parseFloat(x))) return 'number';
    else return 'string';
};

//给郑莹倩师姐：把二附院lis表所有的维度生成json
router.get('/oa/patients2/lisjson',async(ctx,next) => {
    const sql = 'SELECT part3_TEST_ORDER_NAME,part3_CHINESE_NAME,part3_QUANTITATIVE_RESULT FROM SECOND_LIS;';
    await db.query(sql).then(res => {
        let a = {};
        
        res.forEach(function(element){
            if (!a.hasOwnProperty(element.part3_TEST_ORDER_NAME))
            {
                a[element.part3_TEST_ORDER_NAME] = {};
            }
            let b = {};
            b[element.part3_CHINESE_NAME] = isnum(element.part3_QUANTITATIVE_RESULT);
            Object.assign(a[element.part3_TEST_ORDER_NAME],a[element.part3_TEST_ORDER_NAME],b);

        });
        ctx.body = {...Tips[0],'一般检查项目': a};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});

//给郑莹倩师姐：根据条件提取lis中的数据
router.post('/oa/patients2/lis',async(ctx,next) => {
    let testOrderName = ctx.request.body.testOrderName;
    let chineseName = ctx.request.body.chineseName;
    let sql = `SELECT * FROM SECOND_LIS WHERE part3_TEST_ORDER_NAME='${testOrderName}' AND part3_CHINESE_NAME='${chineseName}'`;
    await db.query(sql).then(res => {
        ctx.body = {...Tips[0],data:res};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});

//给许靖琴：二附院根据pid获取主页、费用和Lis信息
router.get('/oa/patient2/:pid',async(ctx,next) => {
    let params = ctx.params;
    let {pid} = params;
    
    let sql1 = `SELECT * FROM SECOND_HOME WHERE part1_pid=${pid};`
    await db.query(sql1).then(async(res) =>{
        let bah = res[0]['part1_bah'];
        let sql2 = `SELECT * FROM SECOND_FEE WHERE part2_bah=${bah};`;
        let sql3 = `SELECT * FROM SECOND_LIS WHERE part3_OUTPATIENT_ID=${bah};`;
        
        res.forEach(function(element){
            if(element.part1_HIS === 0)
            {
                element.part1_csrq = dateModify(element.part1_csrq);
            }
        });

        const part1 = await db.query(sql2);
        const part2 = await db.query(sql3);
        Promise.all([part1,part2]).then((res2) => {
            //console.log(res2);

            ctx.body = {...Tips[0],data_home:res,data_fee:res2[0],data_lis:Utils.generateCategory(res2[1],'part3_TEST_ORDER_NAME')};
        }).catch((e) => {
            ctx.body = {...Tips[1002],reason:e};
        })
    })
    
});

//给李安：获取二附院特定几列的数据
router.get('/oa/patients2/dashboard',async(ctx,next) => {
    let sql = 'SELECT part1_HIS,part1_ylfkfs,part1_nl,part1_cssf,part1_csds,part1_ssmc FROM SECOND_HOME;'
    await db.query(sql).then(res => {
        let paymentMethod = [];
        let age = [];
        let province = [];
        let city = [];
        let surgicalName =[];
        
        res.forEach(function(element){
            paymentMethod.push(element.part1_ylfkfs);
            age.push(element.part1_nl);
            surgicalName.push(element.part1_ssmc);
            //console.log(element.part1_HIS);
            if(element.part1_HIS === 1)
            {
                let a = element.part1_cssf;
                let b = element.part1_csds;
                if(a != null && a != '-' && !(a.charAt(a.length-1) == '市' && a != '北京市' && a != '上海市' && a != '天津市' && a != '重庆市'))
                {
                    province.push(a.replace(/\s+/g,''));
                } 
                if(b != null && b.charAt(b.length-1) != '县' 
                && b.charAt(b.length-1) != '区' 
                && b != '-' 
                && b.charAt(b.length-1) != '号' 
                && b.charAt(b.length-1) != '沟' 
                && b.charAt(b.length-1) != '乡' 
                && b.charAt(b.length-1) != '组' 
                && b != '--' 
                && b.charAt(b.length-1) != '村'
                && b != '无'
                && b != '/')
                {
                    city.push(b.replace(/\s+/g,''));
                }
                
            }
            else 
            {
                var reg = /.+?(省|市|自治区|自治州|县|区|乡|镇|村)/g;
                //var reg1 = /.+?(市|自治州)/g;
                //var reg2 = /.+?(省|自治区)/g;
                var reg2 = /.+?(省|市|自治区|自治州)/g;
                //console.log(element.part1_cssf.match(reg2));
                let s = element.part1_cssf.match(reg);
                if(s != null)
                {
                    let a = s[0];
                    let b = s[1];
                    //console.log(a.slice(a.length-3,a.length));
                    //console.log(a.charAt(a.length-1));
                    //console.log(s[0].charAt(str.length-1));
                    //console.log('a:' + a + 'b:' + b);
                    if(a.charAt(a.length-1) === '省' || a.slice(a.length-3,a.length) === '自治区' || a === '北京市' || a === '上海市' || a === '天津市' || a === '重庆市')
                    {
                        //console.log(a);
                        province.push(a.replace(/\s+/g,''));
                    } 
                    if(a.charAt(a.length-1) === '市' || a.slice(a.length-3,a.length) === '自治州')
                    {
                        //console.log(a);
                        city.push(a.replace(/\s+/g,''));
                    }
                    if(b != null)
                    {
                        if(b.charAt(b.length-1) === '市' || b.slice(b.length-3,b.length) === '自治州')
                        {
                            //console.log(b);
                            city.push(b.replace(/\s+/g,''));
                        }
                    }
                   
                }
                /*
                if(element.part1_cssf.match(reg1) != null)
                {
                    console.log(element.part1_cssf.match(reg1));
                    let s = element.part1_cssf.match(reg1)[0];
                    if(s === '北京市' || s === '上海市' || s === '天津市' || s === '重庆市')
                    {
                        province.push(s);
                    }
                    else if(s.match(reg2) != null)
                    {
                        province.push(s.match(reg2)[0]);
                        city.push(s.match(reg2)[1]);
                    }
                    else
                    {
                        city.push(s);
                    }
                }
                */
                //province.push(element.part1_cssf.match(reg)[0]);
                //city.push(element.part1_cssf.match(reg)[1]);
                //console.log(element.part1_cssf.match(reg));
            }
        });
        ctx.body = {...Tips[0],paymentMethod:paymentMethod,age:age,province:province,city:city,surgicalName:surgicalName};
    }).catch(e => {
        ctx.body = {...Tips[1002],reason:e};
    })
});



module.exports = router;