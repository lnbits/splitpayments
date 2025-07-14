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
    },
    splitDiagramData() {
      // Recreate flow charts when data changes
      this.$nextTick(() => {
        this.recreateCharts()
      })
    },
    currentStep() {
      this.$nextTick(() => {
        this.initFlowChart()
      })
    }
  },
  data() {
    return {
      // Wizard state
      currentStep: 1,
      maxSteps: 3,
      
      // Existing data
      selectedWallet: null,
      currentHash: '', // a string that must match if the edit data is unchanged
      targets: [],
      
      // Chart instances
      treeChart: null,
      treeChart2: null,
      chartUpdateTimeout: null
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
    
    // SVG Flow Chart methods
    initFlowChart() {
      console.log('initFlowChart called, currentStep:', this.currentStep)
      console.log('splitDiagramData:', this.splitDiagramData)
      
      // Create chart for Step 2
      if (this.$refs.flowChart && this.currentStep === 2) {
        console.log('Creating flow chart for Step 2')
        this.createFlowChart('flowChart')
      }
      
      // Create chart for Step 3  
      if (this.$refs.flowChart2 && this.currentStep === 3) {
        console.log('Creating flow chart for Step 3')
        this.createFlowChart('flowChart2')
      }
    },
    recreateCharts() {
      // Safely recreate charts when data changes
      if (this.currentStep === 2 && this.splitDiagramData.length > 0) {
        this.$nextTick(() => {
          this.createFlowChart('flowChart')
        })
      }
      if (this.currentStep === 3 && this.splitDiagramData.length > 0) {
        this.$nextTick(() => {
          this.createFlowChart('flowChart2')
        })
      }
    },
    createFlowChart(containerRef) {
      try {
        if (!this.$refs[containerRef]) {
          console.warn('Container ref not found:', containerRef)
          return
        }
        
        const container = this.$refs[containerRef]
        
        // Clear previous content
        container.innerHTML = ''
        
        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        svg.setAttribute('width', '100%')
        svg.setAttribute('height', '400')
        svg.setAttribute('viewBox', '0 0 400 400')
        svg.style.background = 'transparent'
        
        // Get targets data
        const targets = this.splitDiagramData.filter(item => item.type === 'target')
        
        if (targets.length === 0) {
          container.appendChild(svg)
          return
        }
        
        // Define positions
        const sourceX = 200
        const sourceY = 80
        const branchY = 200
        const targetY = 320
        
        // Calculate target positions to fill horizontal space
        const targetPositions = []
        if (targets.length === 1) {
          targetPositions.push({ x: sourceX, y: targetY })
        } else {
          // Use the full width of the SVG viewBox (400px) with padding
          const padding = 10 // Padding from edges
          const totalWidth = 400 - (padding * 2) // Available width
          const spacing = totalWidth / (targets.length - 1)
          const startX = padding
          
          targets.forEach((target, index) => {
            targetPositions.push({ x: startX + (index * spacing), y: targetY })
          })
        }
        
        // Calculate proportional line thickness
        const maxPercent = Math.max(...targets.map(t => t.percent))
        const maxThickness = 30 // Maximum line thickness in pixels
        
        // Draw flowing lines
        targets.forEach((target, index) => {
          const targetPos = targetPositions[index]
          // Calculate thickness proportional to the highest percentage
          const lineThickness = Math.max(3, (target.percent / maxPercent) * maxThickness)
          
          this.drawFlowingLine(svg, sourceX, sourceY + 40, targetPos.x, targetY - 40, lineThickness, target.color || '#4ade80')
          
          // Add percentage label - center it on the curved line
          const labelX = (sourceX + targetPos.x) / 2
          const labelY = sourceY + 40 + ((targetY - 40) - (sourceY + 40)) * 0.6 // Position at the curve peak
          // this.addPercentageLabel(svg, labelX, labelY, `${target.percent}%`, target.color || '#4ade80')
        })
        
        // Draw source wallet icon
        this.drawWalletIcon(svg, sourceX, sourceY, 'source', this.remainingPercent)
        
        // Draw target wallet icons
        targets.forEach((target, index) => {
          const targetPos = targetPositions[index]
          this.drawWalletIcon(svg, targetPos.x, targetPos.y, 'target', target.percent, target.name)
        })
        
        container.appendChild(svg)
        console.log('Flow chart created successfully for:', containerRef)
      } catch (error) {
        console.error('Error creating flow chart:', error)
      }
    },
    drawFlowingLine(svg, x1, y1, x2, y2, thickness, color) {
      // Create a smooth flowing path like in your reference
      const midY = y1 + (y2 - y1) * 0.6
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      
      // Create the flowing S-curve path
      const pathData = `
        M ${x1} ${y1}
        Q ${x1} ${midY} ${(x1 + x2) / 2} ${midY}
        Q ${x2} ${midY} ${x2} ${y2}
      `
      
      path.setAttribute('d', pathData.trim())
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', thickness)
      path.setAttribute('stroke-linecap', 'butt')
      path.setAttribute('fill', 'none')
      path.setAttribute('opacity', '1')
      
      svg.appendChild(path)
    },
    
    drawWalletIcon(svg, x, y, type, percentage, targetName = null) {
      // Create wallet icon using the PNG image
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      image.setAttribute('x', x - 30)
      image.setAttribute('y', y - 30)
      image.setAttribute('width', 60)
      image.setAttribute('height', 60)
      
      // Try different possible paths for the wallet icon
      const possiblePaths = [
        '/splitpayments/static/image/icon-wallet.png',
        '/static/image/icon-wallet.png',
        'static/image/icon-wallet.png'
      ]
      
      image.setAttribute('href', possiblePaths[0])
      
      // Add color filter for source vs target distinction
      if (type === 'source') {
        // Add blue tint for source wallet
        image.setAttribute('style', 'filter: hue-rotate(200deg) saturate(1.2)')
      }
      
      // Add error handling - if image fails to load, show a fallback
      image.addEventListener('error', () => {
        console.warn('Failed to load wallet icon, using fallback')
        // Remove the broken image and replace with a styled rectangle
        svg.removeChild(image)
        this.drawFallbackWalletIcon(svg, x, y, type, percentage, targetName)
      })
      
      svg.appendChild(image)
      
      // Add target name and percentage below icon if it's a target
      if (type === 'target') {
        // Add split name text
        if (targetName) {
          const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          nameText.setAttribute('x', x)
          nameText.setAttribute('y', y + 45)
          nameText.setAttribute('text-anchor', 'middle')
          nameText.setAttribute('fill', '#374151')
          nameText.setAttribute('font-family', 'Arial, sans-serif')
          nameText.setAttribute('font-size', '14px')
          nameText.setAttribute('font-weight', 'bold')
          nameText.textContent = targetName
          
          svg.appendChild(nameText)
        }
        
        // Add percentage text below name
        const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        percentText.setAttribute('x', x)
        percentText.setAttribute('y', y + 80)
        percentText.setAttribute('text-anchor', 'middle')
        percentText.setAttribute('fill', '#f59e0b')
        percentText.setAttribute('font-family', 'Arial, sans-serif')
        percentText.setAttribute('font-size', '32px')
        percentText.setAttribute('font-weight', 'bold')
        percentText.textContent = `${percentage}%`
        
        svg.appendChild(percentText)
      }
    },
    
    drawFallbackWalletIcon(svg, x, y, type, percentage, targetName = null) {
      // Fallback wallet icon when PNG fails to load
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', x - 30)
      rect.setAttribute('y', y - 30)
      rect.setAttribute('width', 60)
      rect.setAttribute('height', 60)
      rect.setAttribute('rx', 12)
      rect.setAttribute('fill', type === 'source' ? '#6366f1' : '#f59e0b')
      rect.setAttribute('stroke', '#1f2937')
      rect.setAttribute('stroke-width', 2)
      
      svg.appendChild(rect)
      
      // Add Bitcoin symbol
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', x)
      text.setAttribute('y', y + 5)
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('fill', 'white')
      text.setAttribute('font-family', 'Arial, sans-serif')
      text.setAttribute('font-size', '24')
      text.setAttribute('font-weight', 'bold')
      text.textContent = '₿'
      
      svg.appendChild(text)
      
      // Add target name and percentage below icon if it's a target
      if (type === 'target') {
        // Add split name text
        if (targetName) {
          const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          nameText.setAttribute('x', x)
          nameText.setAttribute('y', y + 45)
          nameText.setAttribute('text-anchor', 'middle')
          nameText.setAttribute('fill', '#374151')
          nameText.setAttribute('font-family', 'Arial, sans-serif')
          nameText.setAttribute('font-size', '14px')
          nameText.setAttribute('font-weight', 'bold')
          nameText.textContent = targetName
          
          svg.appendChild(nameText)
        }
        
        // Add percentage text below name
        const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        percentText.setAttribute('x', x)
        percentText.setAttribute('y', y + 65)
        percentText.setAttribute('text-anchor', 'middle')
        percentText.setAttribute('fill', '#f59e0b')
        percentText.setAttribute('font-family', 'Arial, sans-serif')
        percentText.setAttribute('font-size', '16px')
        percentText.setAttribute('font-weight', 'bold')
        percentText.textContent = `${percentage}%`
        
        svg.appendChild(percentText)
      }
    },
    
    addPercentageLabel(svg, x, y, percentage, color) {
      // Create background circle for percentage
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', x)
      circle.setAttribute('cy', y)
      circle.setAttribute('r', 20)
      circle.setAttribute('fill', color)
      circle.setAttribute('opacity', '1')
      
      svg.appendChild(circle)
      
      // Add percentage text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', x)
      text.setAttribute('y', y + 6)
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('fill', 'white')
      text.setAttribute('font-family', 'Arial, sans-serif')
      text.setAttribute('font-size', '20px')
      text.setAttribute('font-weight', 'bold')
      text.textContent = percentage
      
      svg.appendChild(text)
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
    this.$nextTick(() => {
      this.initFlowChart()
    })
  },
  beforeUnmount() {
    // Clean up flow chart containers
    if (this.$refs.flowChart) {
      this.$refs.flowChart.innerHTML = ''
    }
    if (this.$refs.flowChart2) {
      this.$refs.flowChart2.innerHTML = ''
    }
  }
})
