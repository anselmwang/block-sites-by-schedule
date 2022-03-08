// ==UserScript==
// @name         block_site_by_schedule
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        http://*/*
// @match        https://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @require      https://openuserjs.org/src/libs/sizzle/GM_config.js
// @require      http://code.jquery.com/jquery-2.2.4.js
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';
    // core engine
    class TimeRange {
        constructor(start_time, end_time) {
            this.start_time = start_time;
            this.end_time = end_time;
        }

    }

    function date_replacer(key, value) {
        // define pattern to match
        var re = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
        if (typeof value === 'string' && value.match(re)) {
            return new Date(value);
        } else {
            return value; // unchanged
        }
    }



    function pad_num(num, len)
    {
        return num.toString().padStart(len, "0");
    }

    class RuleEngine {
        constructor(rules_str, temp_unblock_time_range) {
            let rule_dic = {};
            rules_str.split("\n").forEach(
                function (line, index) {
                    if (line.trim().length > 0 && line.trim() != '#') {
                        let fields = line.split(" ");
                        if (fields.length != 4) {
                            console.log(`skip wrong format line: "${line}"`);
                        } else {
                            let [rule_id, rule, start_time, end_time] = fields;
                            rule_dic[rule_id] = { rule: new RegExp(rule), start_time, end_time };
                        }
                    }
                }
            );
            console.log(`rules: ${rules_str}`);
            console.log(`rule_dic: ${JSON.stringify(rule_dic)}`);
            this._rule_dic = rule_dic;
            this._temp_unblock_time_range = temp_unblock_time_range;
        }

        _is_temp_unblocked(cur_time)
        {
            if(this._temp_unblock_time_range == null)
            {
                return false;
            }
            return (cur_time >= this._temp_unblock_time_range.start_time && cur_time <= this._temp_unblock_time_range.end_time);
        };

        _is_blocked_by_any_rule(href, cur_time)
        {
            const cur_hm = `${pad_num(cur_time.getHours(), 2)}${pad_num(cur_time.getMinutes(), 2)}`;
            for (let [rule_id, rule] of Object.entries(this._rule_dic)) {
                if (href.match(rule.rule) && cur_hm >= rule.start_time && cur_hm < rule.end_time) {
                    return true;
                }
            }
            return false;
        };

        is_blocked(href, cur_time)
        {
            if (this._is_temp_unblocked(cur_time)) {
                return false;
            }
            if (this._is_blocked_by_any_rule(href, cur_time)) {
                return true;
            }
            return false;
        };

    }

    // core data model
    class PersistentData {
        constructor() {
        }

        get_password()
        {
            return GM_getValue("password", null);
        };
        set_password(password) {
            GM_setValue("password", password);
        };

        get_rules_str()
        {
            return GM_config.get('rules');
        };

        get_temp_unblock_time_range()
        {
            let temp_unblock_time_range = GM_getValue("temp_unblock_time_range", null);
            if(temp_unblock_time_range != null)
            {
                temp_unblock_time_range = JSON.parse(temp_unblock_time_range, date_replacer);
            }
            return temp_unblock_time_range;
        };

        set_temp_unblock_time_range(time_range) {
            GM_setValue("temp_unblock_time_range", JSON.stringify(time_range));
        };

    }

    // Application
    function set_password()
    {
        let password = persistent_data.get_password();
        if(password != null && password != prompt("Old Passowrd:"))
        {
            alert("wrong password");
            return;
        }
        password = prompt("Please enter a new password");
        if(password == null)
        {
            alert(`password is still ${password}.`);
        } else {
            alert(`new password is: ${password}`);
            persistent_data.set_password(password);
        }
    }

    function verify_password()
    {
        let password = persistent_data.get_password();
        if(password == null)
        {
            alert("Please set password first.");
            return false;
        }
        if(password != prompt("Enter password:"))
        {
            return false;
        }
        return true;
    }

    function config()
    {
        if(verify_password())
        {
            GM_config.open();
        }
    }

    function unblock()
    {
        if(verify_password())
        {
            let n_minutes = Number.NaN;
            while(Number.isNaN(n_minutes) || n_minutes <= 0)
            {
                n_minutes = Number(prompt("minutes to unblock?"));
            }
            let start_time = new Date();
            let end_time = new Date(start_time.getTime() + n_minutes*60000);
            persistent_data.set_temp_unblock_time_range(
                new TimeRange(start_time, end_time))
            document.location.reload();
        }
    }

    function main()
    {

        let href = window.location.href;
        const cur_time = new Date();
        if(rule_engine.is_blocked(href, cur_time))
        {
            window.stop();
            $('body').html('Blocked. <a>unblock temporarily</a>');
            $("body a").click(unblock);
        }
    }


    GM_config.init({
        'id': 'MyConfig',
        'fields': {
            'rules': {
                'label': 'Rules',
                'type': 'textarea',
                'rows' : 20,
                'cols' : 80,
            }
        }
    });
    let persistent_data = new PersistentData();
    GM_registerMenuCommand("Set Password", set_password);
    GM_registerMenuCommand("Config", config);
    let rules_str = persistent_data.get_rules_str();
    let rule_engine = new RuleEngine(rules_str, persistent_data.get_temp_unblock_time_range());
    main();

})();
