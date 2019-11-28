/* !
 * Tencent is pleased to support the open source community by making Tencent Server Web available.
 * Copyright (C) 2018 THL A29 Limited, a Tencent company. All rights reserved.
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at
 * http://opensource.org/licenses/MIT
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import * as moment from 'moment'
import * as chalk from 'chalk'
import * as path from 'path'

import { Log, currentContext } from '../context'
import { isLinux } from '../util/isLinux'
import { getCallInfo, Info } from './callInfo'

enum TYPE_2_LEVEL {
  'DEBUG' = 10,
  'INFO' = 20,
  'WARN' = 30,
  'ERROR'= 40,
};
enum TYPE_COLOR {
  'DEBUG' = 'yellow',
  'INFO' = 'blue',
  'WARN' = 'magenta',
  'ERROR'= 'red',
  'FATAL' = 'cyan'
}

let logger: Logger;

export class Logger {
  logLevel: number
  setLogLevel(level: string | number): void{
    if(typeof level == 'string'){
      this.logLevel = TYPE_2_LEVEL[level]
    }else{
      this.logLevel = level;
    }
  }
  getLogLevel(): number{
    return this.logLevel;
  }
  getLog(): Log{
    const log: Log = currentContext().log;
    return log
  }
  clean(): void{
    let log: Log = this.getLog();
    if(log){
      log.arr = null
      log = null;
    }
  }
  fillBuffer(type: string, logStr: string): void{
    const log: Log = this.getLog();
    if(log){
      if(!log.arr){
        log.arr = [];
      }
      if(logStr){
        log.arr.push(logStr);
      }
      if(type){
        if(log[type]){
          log[type] ++;
        }else{
          log[type] = 1;
        }
      }
      const arrLength: number = log.arr.length;
      if(arrLength % 512 === 0 ) {
        const beforeLogClean = currentContext().beforeLogClean;
        if (typeof beforeLogClean === 'function') {
          beforeLogClean();
        }
      }else if (arrLength % 1024 === 0) {
        process.emit('warning', new Error('too many log'));
        this.clean();
      }
    }
  }
  debug(str: string): void{
    this.writeLog('DEBUG', str);
  }
  info(str: string): void{
    this.writeLog('INFO', str)
  }
  warn(str: string): void{
    this.writeLog('WARN', str)
  }
  error(str: string): void{
    this.writeLog('ERROR', str)
  }
  writeLog(type: string, str: string): Logger {
    const level: number = TYPE_2_LEVEL[type]
    const log: Log = this.getLog();
    const useInspectFlag = process.execArgv.join().includes('inspect');
    let logStr: string = null;
    const logLevel: number = this.getLogLevel();
    if(log || level >= logLevel){
      logStr = this.formatStr(type, level, str)
    }
    if(logStr === null) {
      return this;
    }
    // 全息日志写入原始日志
    this.fillBuffer(type, logStr);
    if(level < logLevel){
      return this;
    }
    if(useInspectFlag){
      // Chrome写入原始日志
      Logger.fillInspect(logStr, level);
      // 控制台写入高亮日志
      const logWithColor = this.formatStr(type, level, str, true)
      Logger.fillStdout(logWithColor);
    }else{
      // 非调试模式写入原始日志
      Logger.fillStdout(logStr);
    }
    return this;
  }
  formatStr(type: string, level: number, str: string, useColor?: boolean): string{
    const log: Log = this.getLog();
    let filename: string, line: number, column: number, enable = false, info: Info;
    if(level >= this.getLogLevel()){
      enable = true;
    }
    if(log && log['showLineNumber']){
      enable = true;
    }
    if(enable || !isLinux){
      // Format stack traces to an array of CallSite objects.
      // See CallSite object definitions at https://v8.dev/docs/stack-trace-api.
      info = getCallInfo(3);
      column = info.column;
      line = info.line;
      filename = info.filename || '';
    }
    filename = (filename || '').split(path.sep).join('/');
    const pid = process.pid;
    const SN = currentContext().SN;
    const timestamp = moment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSS')
    const logType = `[${type}]`
    const cpuInfo = `[${pid} ${SN}]`
    const fileInfo = `[${filename}:${line}:${column}]`
    if(useColor){
      const typeColor = TYPE_COLOR[type] || 'black'
      return `${chalk.black(timestamp)} ${chalk[typeColor](logType)} ${chalk.black(cpuInfo)} ${chalk.blue(fileInfo)} ${str}`
    }else{
      return `${timestamp} ${logType} ${cpuInfo} ${fileInfo} ${str}`
    }
  }
  static fillInspect(str: string, level: number): void{
    if(level <= 20){
      (console.originLog || console.log)(str);
    }else if(level <= 30) {
      (console.originWarn || console.warn)(str);
    }else{
      (console.originError || console.error)(str);
    }
  }
  static fillStdout(str: string): void{
    process.stdout.write(str + '\n');
  }
}

if (!logger) {
  logger = new Logger();
}
export default logger;
