// Shared interactions for the prototype
document.addEventListener('DOMContentLoaded', function() {

  // --- Bottom Nav Active State ---
  const currentPage = document.body.getAttribute('data-page');
  document.querySelectorAll('.bottom-nav a').forEach(function(link) {
    if (link.getAttribute('data-nav') === currentPage) {
      link.classList.add('active');
    }
  });

  // --- Collapsible Sections ---
  document.querySelectorAll('[data-toggle="collapse"]').forEach(function(header) {
    header.addEventListener('click', function() {
      const target = this.nextElementSibling;
      const isHidden = target.classList.contains('hidden') || this.classList.contains('collapsed');
      if (this.classList.contains('section-header')) {
        this.parentElement.classList.toggle('collapsed');
      } else {
        this.classList.toggle('collapsed');
        target.classList.toggle('hidden');
      }
    });
  });

  // --- Activity Switcher ---
  const switcher = document.querySelector('.activity-select');
  if (switcher) {
    switcher.addEventListener('click', function() {
      const arrow = this.querySelector('.arrow');
      const dropdown = document.querySelector('.activity-dropdown');
      if (dropdown) {
        dropdown.classList.toggle('hidden');
        arrow.classList.toggle('open');
      }
    });
  }

  // --- Popup Close ---
  document.querySelectorAll('[data-close-popup]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const overlay = document.querySelector('.popup-overlay');
      if (overlay) overlay.classList.remove('show');
      document.querySelectorAll('.popup.show, .action-sheet.show').forEach(function(p) {
        p.classList.remove('show');
      });
    });
  });

  // --- Popup Open ---
  document.querySelectorAll('[data-open-popup]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const target = this.getAttribute('data-open-popup');
      const overlay = document.querySelector('.popup-overlay');
      const popup = document.querySelector('[data-popup="' + target + '"]');
      if (overlay) overlay.classList.add('show');
      if (popup) popup.classList.add('show');
    });
  });

  // --- Checkbox Toggle ---
  document.querySelectorAll('.check-row').forEach(function(row) {
    const cb = row.querySelector('.checkbox');
    if (cb) {
      row.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT') return;
        row.classList.toggle('checked');
        if (row.classList.contains('checked')) {
          cb.innerHTML = '✓';
        } else {
          cb.innerHTML = '';
        }
      });
    }
  });

  // --- Order Select Toggle ---
  document.querySelectorAll('.order-select-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      if (e.target.tagName === 'INPUT') return;
      this.classList.toggle('checked');
      const cb = this.querySelector('.checkbox');
      if (this.classList.contains('checked')) {
        cb.innerHTML = '✓';
      } else {
        cb.innerHTML = '';
      }
    });
  });

  // --- Radio Toggle ---
  document.querySelectorAll('.radio-group').forEach(function(group) {
    group.querySelectorAll('.radio-item').forEach(function(item) {
      item.addEventListener('click', function() {
        group.querySelectorAll('.radio-item').forEach(function(sib) {
          sib.classList.remove('selected');
        });
        this.classList.add('selected');
      });
    });
  });

  // --- 神券互斥 ---
  document.querySelectorAll('[data-exclusive-group]').forEach(function(group) {
    const items = group.querySelectorAll('.radio-item');
    items.forEach(function(item) {
      item.addEventListener('click', function() {
        items.forEach(function(sib) { sib.classList.remove('selected'); });
        this.classList.add('selected');
      });
    });
  });

  // --- 保价弹窗: 添加记录 ---
  document.querySelectorAll('[data-add-price]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var section = this.closest('.section-body');
      var input = section.querySelector('input[data-add-amount]');
      var amount = input.value.trim();
      if (!amount) return;
      var type = input.getAttribute('data-add-type') || '保价';
      var today = new Date();
      var dateStr = ('0' + (today.getMonth()+1)).slice(-2) + '/' + ('0' + today.getDate()).slice(-2);

      // 创建新记录
      var record = document.createElement('div');
      record.className = 'payment-record';
      record.innerHTML =
        '<div class="record-info">' +
          '<span class="record-date">' + dateStr + '</span>' +
          '<span class="record-source store">' + type + '</span>' +
        '</div>' +
        '<span class="record-amount">¥' + amount + '</span>' +
        '<span class="record-delete">删除</span>';

      // 插入到输入行之前
      var addRow = section.querySelector('[data-add-row]');
      section.insertBefore(record, addRow);

      // 清空输入框
      input.value = '';

      // 更新累计金额
      var header = section.closest('.form-section').querySelector('.section-header');
      var totalSpan = header.querySelector('[data-total]');
      if (totalSpan) {
        var amounts = section.querySelectorAll('.payment-record .record-amount');
        var total = 0;
        amounts.forEach(function(el) {
          total += parseFloat(el.textContent.replace(/[¥,]/g, '')) || 0;
        });
        totalSpan.textContent = '累计 ¥' + total;
      }
    });
  });

  // --- 保价弹窗: 删除记录 ---
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('record-delete')) {
      var record = e.target.closest('.payment-record');
      var section = record.closest('.section-body');
      record.remove();
      // 更新累计
      var header = section.closest('.form-section').querySelector('.section-header');
      var totalSpan = header.querySelector('[data-total]');
      if (totalSpan) {
        var amounts = section.querySelectorAll('.payment-record .record-amount');
        var total = 0;
        amounts.forEach(function(el) {
          total += parseFloat(el.textContent.replace(/[¥,]/g, '')) || 0;
        });
        totalSpan.textContent = '累计 ¥' + total;
      }
    }
  });
});
