Date.prototype.yyyymmdd = function() {
    let mm = this.getMonth() + 1;
    let dd = this.getDate();
    let ret = [this.getFullYear(), (mm >= 10 ? '' : '0') + mm, (dd >= 10 ? '' : '0') + dd].join('');
    return ret;
}
module.exports = {
    
}