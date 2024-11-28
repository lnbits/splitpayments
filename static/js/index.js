function hashTargets(targets) {
  return targets
    .filter(isTargetComplete)
    .map(({wallet, percent, alias}) => `${wallet}${percent}${alias}`)
    .join('')
}

function isTargetComplete(target) {
  return (
    target.wallet &&
    target.wallet.trim() !== '' &&
    (target.percent > 0 || target.tag != '')
  )
}

window.app = Vue.createApp({
  el: '#vue',
  mixins: [windowMixin],
  watch: {
    selectedWallet() {
      this.getTargets()
    }
  },
  data() {
    return {
      selectedWallet: null,
      currentHash: '', // a string that must match if the edit data is unchanged
      targets: []
    }
  },
  computed: {
    isDirty() {
      return hashTargets(this.targets) !== this.currentHash
    }
  },
  methods: {
    clearTarget(index) {
      if (this.targets.length == 1) {
        return this.deleteTargets()
      }
      this.targets.splice(index, 1)
      Quasar.Notify.create({
        message: 'Removed item. You must click to save manually.',
        timeout: 500
      })
    },
    getTargets() {
      LNbits.api
        .request(
          'GET',
          '/splitpayments/api/v1/targets',
          this.selectedWallet.adminkey
        )
        .then(response => {
          this.targets = response.data
        })
        .catch(err => {
          LNbits.utils.notifyApiError(err)
        })
    },
    changedWallet(wallet) {
      this.selectedWallet = wallet
      this.getTargets()
    },
    addTarget() {
      this.targets.push({source: this.selectedWallet})
    },
    saveTargets() {
      LNbits.api
        .request(
          'PUT',
          '/splitpayments/api/v1/targets',
          this.selectedWallet.adminkey,
          {
            targets: this.targets
          }
        )
        .then(response => {
          Quasar.Notify.create({
            message: 'Split payments targets set.',
            timeout: 700
          })
        })
        .catch(err => {
          LNbits.utils.notifyApiError(err)
        })
    },
    deleteTargets() {
      LNbits.utils
        .confirmDialog('Are you sure you want to delete all targets?')
        .onOk(() => {
          this.targets = []
          LNbits.api
            .request(
              'DELETE',
              '/splitpayments/api/v1/targets',
              this.selectedWallet.adminkey
            )
            .then(response => {
              Quasar.Notify.create({
                message: 'Split payments targets deleted.',
                timeout: 700
              })
            })
            .catch(err => {
              LNbits.utils.notifyApiError(err)
            })
        })
    }
  },
  created() {
    this.selectedWallet = this.g.user.wallets[0]
  }
})
