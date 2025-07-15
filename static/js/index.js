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
  components: {
    'split-payments-chart': SplitPaymentsChart
  },
  watch: {
    selectedWallet() {
      this.getTargets()
    },
  },
  data() {
    return {
      // Wizard state
      currentStep: 1,
      maxSteps: 3,
      
      // Existing data
      selectedWallet: null,
      currentHash: '', // a string that must match if the edit data is unchanged
      targets: []
    }
  },
  computed: {
    // Step validation
    canProceedFromStep1() {
      return this.selectedWallet !== null
    },
    canProceedFromStep2() {
      return this.targets.length > 0 && this.totalPercent <= 100 && this.allTargetsValid
    },
    totalPercent() {
      return this.targets.reduce((sum, target) => sum + (target.percent || 0), 0)
    },
    remainingPercent() {
      return Math.max(0, 100 - this.totalPercent)
    },
    allTargetsValid() {
      return this.targets.every(target => 
        target.wallet && target.wallet.trim() !== '' && 
        target.percent > 0 && target.percent <= 100 &&
        target.alias && target.alias.trim() !== '' && target.alias.trim().length <= 50
      ) && !this.hasDuplicateRecipients && !this.hasDuplicateNames
    },
    hasValidationErrors() {
      return this.targets.some(target => 
        !target.wallet || target.wallet.trim() === '' ||
        !target.alias || target.alias.trim() === '' ||
        target.percent <= 0 || target.percent > 100
      ) || this.hasDuplicateRecipients || this.hasDuplicateNames
    },
    hasDuplicateRecipients() {
      const walletAddresses = this.targets
        .filter(target => target.wallet && target.wallet.trim() !== '')
        .map(target => target.wallet.trim().toLowerCase())
      
      return walletAddresses.length !== new Set(walletAddresses).size
    },
    hasDuplicateNames() {
      const splitNames = this.targets
        .filter(target => target.alias && target.alias.trim() !== '')
        .map(target => target.alias.trim().toLowerCase())
      
      return splitNames.length !== new Set(splitNames).size
    },
    validationSummary() {
      const errors = []
      if (this.targets.length === 0) {
        errors.push('At least one split target is required')
      }
      if (this.totalPercent > 100) {
        errors.push(`Total percentage (${this.totalPercent}%) exceeds 100%`)
      }
      if (this.hasDuplicateRecipients) {
        errors.push('Duplicate recipient addresses found - each recipient must be unique')
      }
      if (this.hasDuplicateNames) {
        errors.push('Duplicate split names found - each split name must be unique')
      }
      if (this.hasValidationErrors && !this.hasDuplicateRecipients && !this.hasDuplicateNames) {
        errors.push('Some fields have validation errors')
      }
      return errors
    },
    showPercentWarning() {
      return this.totalPercent > 90 && this.totalPercent < 100
    },
    showPercentError() {
      return this.totalPercent > 100
    },
    // Split diagram data
    splitDiagramData() {
      const data = []
      
      // Add source wallet (remaining percentage)
      if (this.remainingPercent > 0) {
        data.push({
          name: this.selectedWallet ? this.selectedWallet.name : 'Source',
          percent: this.remainingPercent,
          type: 'source',
          color: '#1976d2'
        })
      }
      
      // Add target wallets
      this.targets.forEach(target => {
        if (target.percent > 0 && target.alias) {
          data.push({
            name: target.alias,
            percent: target.percent,
            type: 'target',
            color: '#43a047'
          })
        }
      })
      
      return data.sort((a, b) => b.percent - a.percent)
    },
    isDirty() {
      return hashTargets(this.targets) !== this.currentHash
    }
  },
  methods: {
    // Wizard navigation
    nextStep() {
      if (this.currentStep < this.maxSteps) {
        if (this.currentStep === 1 && this.canProceedFromStep1) {
          this.currentStep++
          this.scrollToTop()
        } else if (this.currentStep === 2 && this.canProceedFromStep2) {
          this.currentStep++
          this.scrollToTop()
        }
      }
    },
    prevStep() {
      if (this.currentStep > 1) {
        this.currentStep--
        this.scrollToTop()
      }
    },
    goToStep(step) {
      if (step >= 1 && step <= this.maxSteps) {
        this.currentStep = step
        this.scrollToTop()
      }
    },
    
    // Scroll to top of wizard
    scrollToTop() {
      this.$nextTick(() => {
        // Find the wizard container (the stepper card)
        const wizardElement = document.querySelector('.q-stepper') || document.querySelector('.q-card')
        if (wizardElement) {
          wizardElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest' 
          })
        } else {
          // Fallback to window scroll
          window.scrollTo({ 
            top: 0, 
            behavior: 'smooth' 
          })
        }
      })
    },
    
    // Validation helper methods
    isDuplicateRecipient(index) {
      const currentWallet = this.targets[index]?.wallet?.trim().toLowerCase()
      if (!currentWallet) return false
      
      return this.targets.some((target, i) => 
        i !== index && target.wallet?.trim().toLowerCase() === currentWallet
      )
    },
    isDuplicateName(index) {
      const currentName = this.targets[index]?.alias?.trim().toLowerCase()
      if (!currentName) return false
      
      return this.targets.some((target, i) => 
        i !== index && target.alias?.trim().toLowerCase() === currentName
      )
    },
    
    
    // Target management methods
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
        .then(res => {
          this.targets = res.data.map(t => ({
            ...t,
            targetChoice: t.targetChoice || 'wallet'
          }))
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
      this.targets.push({
        source: this.selectedWallet,
        alias: '',
        wallet: '',
        percent: 0
      })
    },
    saveTargets() {
      // Final validation before saving
      if (this.validationSummary.length > 0) {
        Quasar.Notify.create({
          message: 'Please fix validation errors before saving.',
          timeout: 3000,
          color: 'negative',
          icon: 'error'
        })
        return
      }

      if (!this.selectedWallet) {
        Quasar.Notify.create({
          message: 'Please select a source wallet.',
          timeout: 3000,
          color: 'negative',
          icon: 'error'
        })
        this.currentStep = 1
        this.scrollToTop()
        return
      }

      LNbits.api
        .request(
          'PUT',
          '/splitpayments/api/v1/targets',
          this.selectedWallet.adminkey,
          {
            targets: payload
          }
        )
        .then(response => {
          Quasar.Notify.create({
            message: `Split payments activated! ${this.targets.length} target${this.targets.length !== 1 ? 's' : ''} configured.`,
            timeout: 5000,
            color: 'positive',
            icon: 'check_circle',
            actions: [
              {
                label: 'Dismiss',
                color: 'white',
                handler: () => {}
              }
            ]
          })
          // Update hash to reflect saved state
          this.currentHash = hashTargets(this.targets)
          // Reset to step 1 after successful save
          this.currentStep = 1
          this.scrollToTop()
        })
        .catch(err => {
          LNbits.utils.notifyApiError(err)
          Quasar.Notify.create({
            message: 'Failed to save split payment configuration. Please try again.',
            timeout: 5000,
            color: 'negative',
            icon: 'error'
          })
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
    },
    
    async checkExistingConfigurations() {
      // Check each wallet for existing split payment configurations
      for (const wallet of this.g.user.wallets) {
        try {
          const response = await LNbits.api.request(
            'GET',
            '/splitpayments/api/v1/targets',
            wallet.adminkey
          )
          if (response.data && response.data.length > 0) {
            // Found existing configuration, select this wallet
            this.selectedWallet = wallet
            this.getTargets()
            return
          }
        } catch (err) {
          // Wallet has no configuration, continue checking others
          continue
        }
      }
      
      // No existing configurations found, select first wallet
      if (this.g.user.wallets.length > 0) {
        this.selectedWallet = this.g.user.wallets[0]
      }
    }
  },
  mounted() {
    this.checkExistingConfigurations()
  },
})
